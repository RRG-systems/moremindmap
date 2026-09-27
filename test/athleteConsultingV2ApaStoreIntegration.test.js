import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { flagshipCoachingInput } from '../server/athleteConsultingV2/coach.js';
import { currentApaView } from '../server/athleteConsultingV2/currentApa.js';
import { APA_NARRATIVE_FIELDS, APA_CONFIRMATION_NARRATIVE_FIELDS,
  getApaNarrativeValue, setApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { athleteConsultingV2Keys, createStore, PERSIST_LUA } from '../server/athleteConsultingV2/store.js';

class FakeRedis {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async eval(script, count, ...args) {
    const keys = args.slice(0, count), argv = args.slice(count);
    if (script === PERSIST_LUA) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if ((prior ?? '') !== argv[2]) return -1;
      if (argv[3] === '1' && prior) {
        const backup = this.values.get(keys[2]);
        if (backup && backup !== prior) return -2;
        if (!backup) this.values.set(keys[2], prior);
      }
      this.values.set(keys[1], argv[1]);
      return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) return this.values.get(keys[0]) === argv[0] ? 1 : 0;
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}

const coachOutput = { reply: 'A synthetic coaching response.', plan: null, plan_change: 'none',
  retire_draft: false, learning: [], recap: '' };
const sourceId = change => `APA:CURRENT:${change.id}`;
const clone = value => structuredClone(value);

function reviewedCorrectionNarratives(candidate, prior, change) {
  if (change.kind !== 'correction') return;
  candidate.narrative_updates = APA_NARRATIVE_FIELDS
    .map(field => ({ field, value: clone(getApaNarrativeValue(candidate, field)),
      refs: [...(prior.narrative_provenance?.fields.find(item => item.field === field)?.refs || [])
        .filter(id => !change.supersedes.includes(id)), sourceId(change)] }));
}

function candidateFor({ bundle, record, confirmedChange }, material = true) {
  const prior = currentApaView(bundle, record).artifact;
  const candidate = { confirmation: clone(prior.confirmation), report: clone(prior.report) };
  reviewedCorrectionNarratives(candidate, prior, confirmedChange);
  if (material) {
    const domain = candidate.report.domains.find(item => item.id === 'training');
    domain.gap = 'The athlete confirmed a changed practice constraint for the current week.';
    domain.refs.push(sourceId(confirmedChange));
  }
  return { candidate, changed: material };
}

function fixture(apaComposer = input => candidateFor(input), redis = new FakeRedis()) {
  const scopeId = `apa-store-integration:${randomUUID()}`;
  const store = createStore({ redis, bundles, scopeId,
    coach: async () => clone(coachOutput), apaComposer });
  return { store, redis, scopeId,
    keys: slug => athleteConsultingV2Keys({ scopeId, slug, bundle: bundles[slug] }) };
}

async function act(store, slug, action) {
  return store.act(slug, { ...action, revision: (await store.read(slug)).revision,
    requestId: randomUUID() });
}

async function savedMessage(store, slug = 'nia', speaker = 'athlete') {
  await act(store, slug, { action: 'start' });
  const state = await act(store, slug, { action: 'message', speaker,
    text: speaker === 'athlete' ? 'My current practice week has changed.'
      : 'Coach observation: the practice week may have changed.' });
  return state.messages.filter(item => item.role === 'user').at(-1).id;
}

function updateBody(state, sourceMessageId, requestId = randomUUID(), expectedApaVersion = 0) {
  return { action: 'update_apa', kind: 'reality', supersedes: [],
    reason: 'The athlete confirmed the current practice reality.', sourceMessageId,
    expectedApaVersion, revision: state.revision, requestId };
}

async function publishDraft(store, slug, prepared) {
  return store.act(slug, { action: 'publish_apa', id: prepared.apaDraft.id,
    hash: prepared.apaDraft.hash, revision: prepared.revision, requestId: randomUUID() });
}

test('athlete priority and timing remain a reviewed exact draft until separate manual publication', async () => {
  let composerCalls = 0;
  const values = ['Protect schoolwork while practising the first pass.', '2026-10-03', '2026-10-16'];
  const { store, redis, scopeId } = fixture(input => {
    composerCalls++;
    const prior = currentApaView(input.bundle, input.record).artifact;
    const candidate = { confirmation: clone(prior.confirmation), report: clone(prior.report), narrative_updates: [] };
    APA_CONFIRMATION_NARRATIVE_FIELDS.forEach((field, index) => {
      setApaNarrativeValue(candidate, field, values[index]);
      candidate.narrative_updates.push({ field, value: values[index], refs: [sourceId(input.confirmedChange)] });
    });
    return { candidate, changed: true };
  });
  await act(store, 'nia', { action: 'start' });
  const reported = await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: `My current priority is ${values[0]} Review on October 3, 2026; horizon October 16, 2026.` });
  const sourceMessageId = reported.messages.filter(item => item.role === 'user').at(-1).id;
  const original = clone(bundles.nia), before = await store.read('nia');
  const prepared = await store.act('nia', updateBody(before, sourceMessageId));
  assert.equal(prepared.currentApa, null);
  assert.equal(prepared.apaDraft.previewRecord.artifact.confirmation.priority, values[0]);
  assert.equal(prepared.plan, before.plan);
  assert.deepEqual(prepared.learning, before.learning);
  const cold = createStore({ redis, bundles, scopeId, coach: async () => { throw Error('UNEXPECTED_MODEL'); },
    apaComposer: async () => { throw Error('UNEXPECTED_COMPOSER'); } });
  const reloadedDraft = await cold.read('nia');
  assert.equal(reloadedDraft.currentApa, null);
  assert.equal(reloadedDraft.apaDraft.hash, prepared.apaDraft.hash);
  await assert.rejects(() => cold.act('nia', { action: 'publish_apa', id: prepared.apaDraft.id,
    hash: 'f'.repeat(64), revision: reloadedDraft.revision, requestId: randomUUID() }), /CURRENT_APA_DRAFT_CHANGED/u);
  assert.equal((await cold.read('nia')).currentApa, null);
  const published = await publishDraft(cold, 'nia', await cold.read('nia'));
  assert.equal(published.currentApa.version, 1);
  assert.equal(published.apaDraft, null);
  for (const [index, field] of APA_CONFIRMATION_NARRATIVE_FIELDS.entries()) {
    assert.equal(getApaNarrativeValue(published.currentApa.artifact, field), values[index]);
    assert.ok(published.currentApa.receipts[0].material_paths.includes(field));
  }
  assert.equal(published.currentApa.artifact.confirmation.assessment_date, original.apa.confirmation.assessment_date);
  assert.deepEqual(published.currentApa.artifact.sources.slice(0, original.apa.sources.length), original.apa.sources);
  assert.deepEqual(published.currentApa.artifact.bos_sources, original.apa.bos_sources);
  assert.deepEqual(bundles.nia, original);
  assert.equal((await cold.read('sofia')).currentApa, null);
  assert.deepEqual((await cold.read('nia')).currentApa, published.currentApa);
  assert.equal(composerCalls, 1);
});

test('whole-picture companion remains a private hash-bound draft across cold read until exact publication', async () => {
  let calls = 0;
  const { store, redis, scopeId, keys } = fixture(input => {
    calls++;
    const prior = currentApaView(input.bundle, input.record).artifact;
    const candidate = { confirmation: clone(prior.confirmation), report: clone(prior.report) };
    candidate.report.opening = 'The synthetic draft is submitted; Friday practice now fits the rehearsal week.';
    candidate.report.what_we_dont_know = ['Whether the Friday cue helps.', 'Whether rehearsals keep the same timing.'];
    candidate.narrative_updates = ['opening', 'what_we_dont_know'].map(field => ({
      field, value: clone(candidate.report[field]), refs: [sourceId(input.confirmedChange)],
    }));
    return { candidate, changed: true };
  });
  const sourceMessageId = await savedMessage(store);
  const before = await store.read('nia');
  const body = updateBody(before, sourceMessageId);
  const prepared = await store.act('nia', body);
  assert.equal(calls, 1);
  assert.equal(prepared.currentApa, null);
  assert.equal(prepared.plan, before.plan);
  const opening = prepared.apaDraft.previewRecord.receipts[0].narrative_changes
    .find(change => change.field === 'opening');
  assert.equal(opening.before, bundles.nia.apa.report.opening);
  assert.equal(opening.after, 'The synthetic draft is submitted; Friday practice now fits the rehearsal week.');
  assert.equal(opening.before_refs, null);
  const stored = JSON.parse(redis.values.get(keys('nia').state)).state.apaDraft;
  assert.equal(stored.candidate.narrative_updates[0].value, opening.after);
  const cold = createStore({ redis, bundles, scopeId,
    coach: async () => clone(coachOutput), apaComposer: () => { throw new Error('OFFLINE_COMPOSER_MUST_NOT_RUN'); } });
  const restored = await cold.read('nia');
  assert.equal(restored.apaDraft.hash, prepared.apaDraft.hash);
  assert.equal(restored.currentApa, null);
  await assert.rejects(() => publishDraft(cold, 'nia', { ...restored,
    apaDraft: { ...restored.apaDraft, hash: '0'.repeat(64) } }), /CURRENT_APA_DRAFT_CHANGED/u);
  assert.equal((await cold.read('nia')).currentApa, null);
  const published = await publishDraft(cold, 'nia', await cold.read('nia'));
  assert.equal(published.currentApa.artifact.report.opening, opening.after);
  assert.deepEqual(published.currentApa.artifact.report.what_we_dont_know,
    ['Whether the Friday cue helps.', 'Whether rehearsals keep the same timing.']);
  assert.equal(published.currentApa.artifact.narrative_provenance.fields
    .find(item => item.field === 'opening').status, 'SOURCE_BOUND');
  assert.equal(published.plan, before.plan);
  assert.equal(published.apaDraft, null);
  assert.equal(currentApaView(bundles.nia, published.currentApa).version, 1);
  assert.equal((await cold.read('sofia')).currentApa, null);
  assert.equal(calls, 1);
  assert.equal(bundles.nia.apa.report.opening, opening.before);
});

test('uncited whole-picture output fails once without staging or changing any saved APA', async () => {
  let calls = 0;
  const { store } = fixture(input => {
    calls++;
    const result = candidateFor(input);
    result.candidate.report.opening = 'An unsupported new whole-picture explanation.';
    // No typed narrative source companion: domain citation cannot authorize it.
    return result;
  });
  const sourceMessageId = await savedMessage(store), before = await store.read('nia');
  const body = updateBody(before, sourceMessageId);
  const failed = await store.act('nia', body);
  assert.equal(failed.currentApa, null);
  assert.equal(failed.apaDraft, null);
  assert.equal(failed.plan, before.plan);
  assert.ok(failed.lastError);
  assert.equal(calls, 1);
  await store.act('nia', body);
  assert.equal(calls, 1);
  assert.equal((await store.read('nia')).currentApa, null);
});

test('pinned Nia material update prepares only, then exact athlete approval publishes a version', async () => {
  let composerCalls = 0;
  const { store, redis, keys } = fixture(input => { composerCalls++; return candidateFor(input); });
  const sourceMessageId = await savedMessage(store);
  const before = await store.read('nia');
  const body = updateBody(before, sourceMessageId);
  const prepared = await store.act('nia', body);
  assert.equal(composerCalls, 1);
  assert.equal(prepared.currentApa, null);
  assert.equal(prepared.apaDraft.previewRecord.version, 1);
  assert.equal(prepared.events.at(-1).type, 'current_apa_draft_prepared');
  const after = await publishDraft(store, 'nia', prepared);
  assert.equal(after.currentApa.version, 1);
  assert.equal(after.apaDraft, null);
  assert.equal(after.currentApa.receipts[0].source_message_id, sourceMessageId);
  assert.equal(after.currentApa.binding.baseline_hash, bundles.nia.apa.artifact_sha256);
  assert.equal(after.currentApa.artifact.baseline_artifact_sha256, bundles.nia.apa.artifact_sha256);
  assert.equal(after.currentApa.artifact.sources.at(-1).source_message_id, sourceMessageId);
  assert.equal(after.events.at(-1).type, 'current_apa_published');
  assert.equal(currentApaView(bundles.nia, after.currentApa).version, 1);
  const envelope = JSON.parse(redis.values.get(keys('nia').state));
  assert.equal(envelope.operations[body.requestId].status, 'completed');
  assert.equal(envelope.state.currentApa.receipts[0].source_message_id, sourceMessageId);
  assert.equal(bundles.nia.apa.current_apa_version, undefined);
});

test('confirmed no-change is a terminal receipt without inventing an APA version', async () => {
  const { store } = fixture(input => candidateFor(input, false));
  const sourceMessageId = await savedMessage(store);
  const after = await store.act('nia', updateBody(await store.read('nia'), sourceMessageId));
  assert.equal(after.currentApa, null);
  assert.equal(after.events.at(-1).type, 'current_apa_no_change');
  assert.equal(after.events.at(-1).version, 0);
  assert.equal(currentApaView(bundles.nia, after.currentApa).version, 0);
});

test('only the selected athlete can publish the exact displayed prepared draft', async () => {
  const { store } = fixture(input => candidateFor(input));
  const sourceMessageId = await savedMessage(store);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), sourceMessageId));
  await assert.rejects(() => store.act('nia', { action: 'publish_apa',
    id: prepared.apaDraft.id, hash: 'stale-display-hash', revision: prepared.revision,
    requestId: randomUUID() }), /CURRENT_APA_DRAFT_CHANGED/u);
  const sofia = await store.read('sofia');
  await assert.rejects(() => store.act('sofia', { action: 'publish_apa',
    id: prepared.apaDraft.id, hash: prepared.apaDraft.hash, revision: sofia.revision,
    requestId: randomUUID() }), /CURRENT_APA_DRAFT_CHANGED/u);
  assert.equal((await store.read('nia')).currentApa, null);
  const published = await publishDraft(store, 'nia', prepared);
  assert.equal(published.currentApa.version, 1);
  assert.equal((await store.read('sofia')).currentApa, null);
});

test('stale APA version fails before composer or any state mutation', async () => {
  let calls = 0;
  const { store } = fixture(input => { calls++; return candidateFor(input); });
  const sourceMessageId = await savedMessage(store);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), sourceMessageId));
  const first = await publishDraft(store, 'nia', prepared);
  const before = await store.read('nia');
  await assert.rejects(() => store.act('nia', updateBody(before, sourceMessageId,
    randomUUID(), 0)), /CURRENT_APA_STALE_VERSION/u);
  assert.equal(calls, 1);
  assert.deepEqual(await store.read('nia'), before);
  assert.equal(first.currentApa.version, 1);
});

test('Coach note and cross-athlete source cannot prepare an APA reading', async () => {
  let calls = 0;
  const { store } = fixture(input => { calls++; return candidateFor(input); });
  const coachMessageId = await savedMessage(store, 'nia', 'coach');
  const niaBefore = await store.read('nia');
  await assert.rejects(() => store.act('nia', updateBody(niaBefore, coachMessageId)),
    /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  assert.deepEqual(await store.read('nia'), niaBefore);
  const niaAthleteSource = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'My current practice week has changed.' })).messages.filter(item => item.role === 'user').at(-1).id;
  await act(store, 'sofia', { action: 'start' });
  const sofiaBefore = await store.read('sofia');
  await assert.rejects(() => store.act('sofia', updateBody(sofiaBefore, niaAthleteSource)),
    /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  assert.deepEqual(await store.read('sofia'), sofiaBefore);
  assert.equal((await store.read('nia')).currentApa, null);
  assert.equal(calls, 0);
});

test('failed composer leaves the previously published APA artifact and receipt unchanged', async () => {
  let calls = 0;
  const { store } = fixture(input => {
    calls++;
    if (calls === 2) throw new Error('SIMULATED_APA_FAILURE');
    return candidateFor(input);
  });
  const firstMessage = await savedMessage(store);
  const firstPrepared = await store.act('nia', updateBody(await store.read('nia'), firstMessage));
  const first = await publishDraft(store, 'nia', firstPrepared);
  const prior = clone(first.currentApa);
  const secondMessage = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'I confirm another current practice detail.' })).messages.filter(item => item.role === 'user').at(-1).id;
  const after = await store.act('nia', updateBody(await store.read('nia'), secondMessage,
    randomUUID(), 1));
  assert.equal(calls, 2);
  assert.deepEqual(after.currentApa, prior);
  assert.equal(after.events.at(-1).type, 'apa_update_failed');
  assert.equal(after.events.at(-1).code, 'SIMULATED_APA_FAILURE');
  assert.match(after.lastError, /current saved reading is unchanged/u);
});

test('accepted-plan change invalidates a prepared APA draft before publication', async () => {
  const { store } = fixture(input => candidateFor(input));
  const sourceMessageId = await savedMessage(store);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), sourceMessageId));
  const proposed = { title: 'A separately chosen plan', why: 'It fits the week.',
    steps: [{ action: 'Try one cue', when: 'Thursday', notice: 'Whether it helped', owner: 'athlete' }],
    review: 'Next week' };
  const drafted = await act(store, 'nia', { action: 'draft', plan: proposed });
  assert.ok(drafted.apaDraft);
  const accepted = await act(store, 'nia', { action: 'approve', id: drafted.draft.id,
    hash: drafted.draft.hash, actor: 'athlete' });
  assert.equal(accepted.plan.title, proposed.title);
  assert.equal(accepted.apaDraft, null);
  assert.equal(accepted.currentApa, null);
  assert.ok(accepted.events.some(item => item.type === 'current_apa_draft_invalidated'
    && item.draft_id === prepared.apaDraft.id));
  await assert.rejects(() => store.act('nia', { action: 'publish_apa',
    id: prepared.apaDraft.id, hash: prepared.apaDraft.hash,
    revision: accepted.revision, requestId: randomUUID() }), /CURRENT_APA_DRAFT_CHANGED/u);
});

test('athlete RSL correction invalidates a prepared APA draft and keeps it unpublished', async () => {
  const { store } = fixture(input => candidateFor(input));
  const firstMessage = await savedMessage(store);
  const remembered = await act(store, 'nia', { action: 'confirm_fact', sourceMessageId: firstMessage });
  const target = remembered.personalMemory.items.find(item => item.event_type === 'ATHLETE_STATEMENT');
  assert.ok(target?.event_id);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), firstMessage));
  const correctionMessage = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'Correction: Thursday, not Tuesday, is the short practice.' }))
    .messages.filter(item => item.role === 'user').at(-1).id;
  const corrected = await act(store, 'nia', { action: 'confirm_fact',
    sourceMessageId: correctionMessage, targetEventId: target.event_id });
  assert.equal(corrected.apaDraft, null);
  assert.equal(corrected.currentApa, null);
  assert.equal(corrected.apaNeedsReview, true);
  assert.ok(corrected.events.some(item => item.type === 'current_apa_draft_invalidated'
    && item.draft_id === prepared.apaDraft.id));
});

test('an RSL correction cannot be cleared by an old or unrelated APA source', async () => {
  const { store } = fixture(({ bundle, record, confirmedChange }) => {
    const prior = currentApaView(bundle, record).artifact;
    const candidate = { confirmation: clone(prior.confirmation), report: clone(prior.report) };
    const domain = candidate.report.domains.find(item => item.id === 'training');
    domain.gap = record
      ? 'The athlete corrected the practice constraint: Thursday is the short practice.'
      : 'The athlete first reported Tuesday as the short practice.';
    domain.refs = domain.refs.filter(id => !confirmedChange.supersedes.includes(id));
    domain.refs.push(sourceId(confirmedChange));
    reviewedCorrectionNarratives(candidate, prior, confirmedChange);
    return { candidate, changed: true };
  });
  const firstMessage = await savedMessage(store);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), firstMessage));
  const first = await publishDraft(store, 'nia', prepared);
  const fact = await act(store, 'nia', { action: 'confirm_fact', sourceMessageId: firstMessage });
  const target = fact.personalMemory.items.find(item => item.event_type === 'ATHLETE_STATEMENT');
  const correctedMessage = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'Correction: Thursday, not Tuesday, is my short practice.' }))
    .messages.filter(item => item.role === 'user').at(-1).id;
  const corrected = await act(store, 'nia', { action: 'confirm_fact',
    sourceMessageId: correctedMessage, targetEventId: target.event_id });
  assert.equal(corrected.apaNeedsReview, true);
  const oldSource = first.currentApa.receipts[0].source_id;
  await assert.rejects(() => store.act('nia', updateBody(corrected, firstMessage,
    randomUUID(), 1)), /CURRENT_APA_REVIEW_SOURCE_REQUIRED/u);
  const unrelatedMessage = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'An unrelated synthetic detail.' })).messages.filter(item => item.role === 'user').at(-1).id;
  const before = await store.read('nia');
  await assert.rejects(() => store.act('nia', { ...updateBody(before, unrelatedMessage,
    randomUUID(), 1), kind: 'correction', supersedes: [oldSource] }),
  /CURRENT_APA_REVIEW_SOURCE_REQUIRED/u);
  assert.equal((await store.read('nia')).apaNeedsReview, true);
  const correction = await store.act('nia', { ...updateBody(await store.read('nia'),
    correctedMessage, randomUUID(), 1), kind: 'correction', supersedes: [oldSource] });
  assert.equal(correction.currentApa.version, 1);
  assert.equal(correction.apaDraft.previewRecord.version, 2);
  assert.equal(correction.apaNeedsReview, true);
  const published = await publishDraft(store, 'nia', correction);
  assert.equal(published.currentApa.version, 2);
  assert.equal(published.apaNeedsReview, false);
  assert.equal(published.currentApa.receipts.at(-1).source_message_id, correctedMessage);
});

test('failed APA correction preserves prior version as historical awaiting athlete review', async () => {
  let calls = 0;
  const { store } = fixture(input => {
    calls++;
    if (calls === 2) throw new Error('SIMULATED_CORRECTION_FAILURE');
    return candidateFor(input);
  });
  const firstMessage = await savedMessage(store);
  const prepared = await store.act('nia', updateBody(await store.read('nia'), firstMessage));
  const published = await publishDraft(store, 'nia', prepared);
  const prior = clone(published.currentApa);
  const correctionMessage = (await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'Correction: Thursday is now the short practice, not Tuesday.' }))
    .messages.filter(item => item.role === 'user').at(-1).id;
  const before = await store.read('nia');
  const failed = await store.act('nia', { ...updateBody(before, correctionMessage,
    randomUUID(), 1), kind: 'correction', supersedes: [prior.receipts[0].source_id] });
  assert.deepEqual(failed.currentApa, prior);
  assert.equal(failed.apaDraft, null);
  assert.equal(failed.apaNeedsReview, true);
  assert.equal(failed.events.at(-1).type, 'apa_update_failed');
  const modelInput = flagshipCoachingInput(bundles.nia, failed, 'CHAT');
  assert.equal(modelInput.current_apa_status, 'HISTORICAL_AWAITING_ATHLETE_REVIEW');
  assert.equal(modelInput.full_youth_apa, null);
  assert.equal(calls, 2);
});

test('duplicate update request replays without a second composer call or altered receipt', async () => {
  let calls = 0;
  const { store } = fixture(input => { calls++; return candidateFor(input); });
  const sourceMessageId = await savedMessage(store);
  const body = updateBody(await store.read('nia'), sourceMessageId, 'apa-exact-replay');
  const first = await store.act('nia', body);
  const replay = await store.act('nia', body);
  assert.deepEqual(replay, first);
  assert.equal(calls, 1);
  await assert.rejects(() => store.act('nia', { ...body, reason: 'Changed intent' }), /REQUEST_ID_REUSED/u);
});

test('lost pending acknowledgement recovers unknown without calling composer', async () => {
  let calls = 0;
  const { store, redis, keys } = fixture(input => { calls++; return candidateFor(input); });
  const sourceMessageId = await savedMessage(store);
  const body = updateBody(await store.read('nia'), sourceMessageId, 'apa-pending-ack');
  const evalOriginal = redis.eval.bind(redis);
  let drop = true;
  redis.eval = async (script, count, ...args) => {
    const result = await evalOriginal(script, count, ...args);
    if (script === PERSIST_LUA && drop
      && JSON.parse(args[count + 1]).operations[body.requestId]?.status === 'pending') {
      drop = false;
      throw new Error('Simulated pending acknowledgement loss');
    }
    return result;
  };
  await assert.rejects(() => store.act('nia', body), /pending acknowledgement loss/u);
  const recovered = await store.act('nia', body);
  assert.equal(recovered.currentApa, null);
  assert.equal(recovered.events.at(-1).type, 'apa_update_unknown');
  assert.equal(recovered.events.at(-1).code, 'COACH_OUTCOME_UNKNOWN');
  assert.equal(calls, 0);
  assert.equal(JSON.parse(redis.values.get(keys('nia').state)).operations[body.requestId].status, 'unknown');
});
