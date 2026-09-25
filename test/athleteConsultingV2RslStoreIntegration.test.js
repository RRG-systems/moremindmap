import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { applyLiveCapture } from '../server/athleteConsultingV2/capture.js';
import { hash } from '../server/athleteConsultingV2/state.js';
import { createStore, athleteConsultingV2Keys, PERSIST_LUA } from '../server/athleteConsultingV2/store.js';

class FakeRedis {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value)); return 'OK';
  }
  async eval(script, count, ...args) {
    const keys = args.slice(0, count), argv = args.slice(count);
    if (script === PERSIST_LUA) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      const prior = this.values.get(keys[1]);
      if ((prior ?? '') !== argv[2]) return -1;
      if (argv[3] === '1' && prior && !this.values.has(keys[2])) this.values.set(keys[2], prior);
      this.values.set(keys[1], argv[1]); return 1;
    }
    if (script.includes("redis.call('PEXPIRE'")) return this.values.get(keys[0]) === argv[0] ? 1 : 0;
    if (script.includes("redis.call('DEL'")) {
      if (this.values.get(keys[0]) !== argv[0]) return 0;
      this.values.delete(keys[0]); return 1;
    }
    throw new Error('UNEXPECTED_LUA');
  }
}
function bundle(slug) {
  const mm = `SYNTHETIC-${slug.toUpperCase()}`;
  const bos = { synthetic: true, mm, reading: { chapters: [{ id: 'portrait' }] } };
  const apa = { synthetic: true, mm, report: { opening: 'Fictional APA opening.' } };
  return { person: { synthetic: true, slug, mm, name: slug === 'nia' ? 'Nia Brooks' : 'Sofia Reed' },
    bos: { ...bos, artifact_sha256: hash(bos) },
    apa: { ...apa, artifact_sha256: hash(apa) } };
}
const bundles = { nia: bundle('nia'), sofia: bundle('sofia') };
const output = (task) => ({ reply: `Synthetic ${task} response.`, plan: null,
  plan_change: 'none', retire_draft: false,
  learning: task === 'CHAT' ? ['One precise cue helps me reset.'] : [], recap: '' });
function fixture({ redis = new FakeRedis(), scopeId = 'leadership-synthetic-scope-A',
  modelInputs = [] } = {}) {
  const store = createStore({ redis, bundles, scopeId, localAction: applyLiveCapture,
    coach: async (_bundle, state, task) => {
      modelInputs.push({ task, memory: structuredClone(state.governedMemory),
        recent: state.messages.filter(message => message.coach_note_handoff !== 'next_opening').slice(-50) });
      return output(task);
    } });
  const keys = slug => athleteConsultingV2Keys({ scopeId, slug, bundle: bundles[slug] });
  const raw = slug => JSON.parse(redis.values.get(keys(slug).state));
  return { store, redis, keys, raw, modelInputs };
}
async function act(store, slug, action) {
  const state = await store.read(slug);
  return store.act(slug, { ...action, revision: state.revision, requestId: randomUUID() });
}
function latestAthleteMessage(state) {
  return state.messages.filter(message => message.role === 'user'
    && message.speaker === 'athlete' && !message.capture).at(-1).id;
}
const plan = { title: 'One chosen next step', why: 'A fictional athlete-owned choice.',
  steps: [{ action: 'Ask one clear question.', when: 'At the next practice.',
    notice: 'Whether the answer helps.', owner: 'athlete' }], review: 'At the next session.' };

test('athlete-approved learning and accepted plan append typed events; drafts and suggestions do not', async () => {
  const { store, raw, modelInputs } = fixture();
  let state = await act(store, 'nia', { action: 'start' });
  state = await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'A synthetic check-in.' });
  assert.deepEqual(raw('nia').state.rslEvents, []);
  assert.deepEqual(state.suggestedLearning, ['One precise cue helps me reset.']);
  state = await act(store, 'nia', { action: 'remember', items: ['One precise cue helps me reset.'] });
  assert.equal(state.learning.length, 1);
  assert.equal(raw('nia').state.rslEvents.at(-1).event_type, 'APPROVED_LEARNING');
  state = await act(store, 'nia', { action: 'draft', plan });
  assert.equal(raw('nia').state.rslEvents.length, 1);
  state = await act(store, 'nia', { action: 'approve', id: state.draft.id,
    hash: state.draft.hash, actor: 'athlete' });
  assert.equal(state.plan.title, plan.title);
  assert.deepEqual(raw('nia').state.rslEvents.map(event => event.event_type),
    ['APPROVED_LEARNING', 'ACCEPTED_PLAN']);
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'A later check-in.' });
  const memory = modelInputs.at(-1).memory;
  assert.deepEqual(memory.items.map(item => item.event_type),
    ['ACCEPTED_PLAN', 'APPROVED_LEARNING']);
  assert.equal(memory.coach_observation_promoted, false);
});

test('forget and reapprove preserve typed retraction lineage without resurrecting old learning', async () => {
  const { store, raw, modelInputs } = fixture();
  await act(store, 'nia', { action: 'start' });
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'First check-in.' });
  let state = await act(store, 'nia', { action: 'remember', items: ['One precise cue helps me reset.'] });
  const oldId = state.learning[0].id;
  state = await act(store, 'nia', { action: 'forget', id: oldId });
  assert.equal(state.learning.length, 0);
  assert.deepEqual(raw('nia').state.rslEvents.map(event => event.event_type),
    ['APPROVED_LEARNING', 'RETRACTION']);
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'I still want one precise cue.' });
  assert.equal(modelInputs.at(-1).memory.items.some(item => item.payload?.text?.includes('precise cue')), false);
  state = await act(store, 'nia', { action: 'remember', items: ['One precise cue helps me reset.'] });
  assert.notEqual(state.learning[0].id, oldId);
  assert.deepEqual(raw('nia').state.rslEvents.map(event => event.event_type),
    ['APPROVED_LEARNING', 'RETRACTION', 'APPROVED_LEARNING']);
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'Another check-in.' });
  const active = modelInputs.at(-1).memory.items.filter(item => item.event_type === 'APPROVED_LEARNING');
  assert.equal(active.length, 1);
  assert.equal(active[0].payload.text, 'One precise cue helps me reset.');
});

test('explicit athlete fact/correction survives reload and return while selected athletes and scopes remain isolated', async () => {
  const first = fixture();
  await act(first.store, 'nia', { action: 'start' });
  let state = await act(first.store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'I have two school conflicts this week.' });
  state = await act(first.store, 'nia', { action: 'confirm_fact', sourceMessageId: latestAthleteMessage(state) });
  const original = state.personalMemory.items[0];
  assert.equal(original.event_type, 'ATHLETE_STATEMENT');
  state = await act(first.store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'Correction: there is only one school conflict.' });
  state = await act(first.store, 'nia', { action: 'confirm_fact',
    sourceMessageId: latestAthleteMessage(state), targetEventId: original.event_id });
  assert.equal(state.personalMemory.items.length, 1);
  assert.equal(state.personalMemory.items[0].event_type, 'CORRECTION');
  assert.match(state.personalMemory.items[0].text, /only one/u);
  assert.doesNotMatch(JSON.stringify(state.personalMemory), /two school conflicts/u);
  const reloaded = fixture({ redis: first.redis, scopeId: 'leadership-synthetic-scope-A' });
  assert.deepEqual((await reloaded.store.read('nia')).personalMemory, state.personalMemory);
  assert.equal((await reloaded.store.read('sofia')).personalMemory.items.length, 0);
  const otherScope = fixture({ redis: first.redis, scopeId: 'leadership-synthetic-scope-B' });
  assert.equal((await otherScope.store.read('nia')).personalMemory.items.length, 0);
  assert.notEqual(first.keys('nia').state, first.keys('sofia').state);
  assert.notEqual(first.keys('nia').state, otherScope.keys('nia').state);
  await act(reloaded.store, 'nia', { action: 'close' });
  await act(reloaded.store, 'nia', { action: 'finish' });
  await act(reloaded.store, 'nia', { action: 'start' });
  const opening = reloaded.modelInputs.at(-1);
  assert.equal(opening.task, 'OPENING');
  assert.equal(opening.memory.items.filter(item => item.event_type === 'CORRECTION').length, 1);
  assert.equal(opening.memory.items.some(item => item.payload?.text?.includes('two school conflicts')), false);
});

test('durable RSL fact custody rejects a rewritten saved source message', async () => {
  const { store, raw, redis, keys } = fixture();
  await act(store, 'nia', { action: 'start' });
  const spoken = await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'This is my synthetic confirmed fact.' });
  const messageId = latestAthleteMessage(spoken);
  await act(store, 'nia', { action: 'confirm_fact', sourceMessageId: messageId });
  const envelope = raw('nia');
  const event = envelope.state.rslEvents.at(-1);
  assert.equal(event.source_message_id, messageId);
  assert.match(event.source_message_hash, /^[a-f0-9]{64}$/u);
  envelope.state.messages.find(message => message.id === messageId).text = 'Rewritten after confirmation.';
  const { envelope_hash: _old, ...unsigned } = envelope;
  envelope.envelope_hash = hash(unsigned);
  redis.values.set(keys('nia').state, JSON.stringify(envelope));
  await assert.rejects(() => store.read('nia'), /ATHLETE_V2_STATE_CORRUPT/u);
});

test('confirm_fact cannot correct approved learning or promote a coach observation', async () => {
  const { store, raw } = fixture();
  await act(store, 'nia', { action: 'start' });
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'An athlete statement.' });
  let state = await act(store, 'nia', { action: 'remember', items: ['One precise cue helps me reset.'] });
  const learningEvent = raw('nia').state.rslEvents.find(event => event.event_type === 'APPROVED_LEARNING');
  await assert.rejects(() => act(store, 'nia', { action: 'confirm_fact',
    sourceMessageId: latestAthleteMessage(state), targetEventId: learningEvent.event_id }),
  /ATHLETE_RSL_TARGET_NOT_ACTIVE/u);
  const coachNote = await act(store, 'nia', { action: 'capture_demo', capture: {
    subject: 'nia', role: 'coach', source: 'Coach Alex (synthetic)', kind: 'text',
    channel: 'coach_connect_box04_v1', text: 'Coach observation stays unverified.',
    attachments: [], reviewed: true } });
  const coachMessageId = coachNote.messages.at(-1).id;
  await assert.rejects(() => act(store, 'nia', { action: 'confirm_fact',
    sourceMessageId: coachMessageId }), /ATHLETE_FACT_SOURCE_REQUIRED/u);
  state = await store.read('nia');
  assert.equal(state.personalMemory.items.length, 0);
  assert.equal(raw('nia').state.rslEvents.length, 1);
});

test('an older-than-50 saved fact reaches later model memory but client projection omits private ledger', async () => {
  const { store, raw, modelInputs } = fixture();
  await act(store, 'nia', { action: 'start' });
  let state = await act(store, 'nia', { action: 'message', speaker: 'athlete',
    text: 'My saved synthetic fact is older than the conversation window.' });
  const messageId = latestAthleteMessage(state);
  state = await act(store, 'nia', { action: 'confirm_fact', sourceMessageId: messageId });
  for (let index = 0; index < 55; index++) {
    state = await act(store, 'nia', { action: 'capture_demo', capture: {
      subject: 'nia', role: 'athlete', source: 'Nia Brooks (synthetic)', kind: 'text',
      text: `Synthetic diary entry ${index}.`, attachments: [], reviewed: true } });
  }
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'Can we continue?' });
  const call = modelInputs.at(-1);
  assert.equal(call.recent.some(message => message.id === messageId), false);
  assert.equal(call.memory.items.some(item => item.payload?.text?.includes('older than')), true);
  assert.equal(Object.hasOwn(state, 'rslEvents'), false);
  assert.equal(Object.hasOwn(state, 'governedMemory'), false);
  assert.deepEqual(Object.keys(state.personalMemory.items[0]).sort(),
    ['event_id', 'event_type', 'recorded_at', 'text']);
  assert.equal(JSON.stringify(state.personalMemory).includes('scope_hash'), false);
  assert.equal(raw('nia').state.rslEvents.length, 1);
});
