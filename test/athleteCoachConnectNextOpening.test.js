import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { applyLiveCapture } from '../server/athleteConsultingV2/capture.js';
import { coachingInput } from '../server/athleteConsultingV2/coach.js';
import { hash, initial, pendingCoachNoteIds } from '../server/athleteConsultingV2/state.js';
import { createStore, PERSIST_LUA } from '../server/athleteConsultingV2/store.js';

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
      if (argv[3] === '1' && prior) {
        const backup = this.values.get(keys[2]);
        if (backup && backup !== prior) return -2;
        if (!backup) this.values.set(keys[2], prior);
      }
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

function report(slug) {
  const mm = `SYNTHETIC-${slug.toUpperCase()}`;
  const bos = { synthetic: true, mm, reading: { chapters: [] } };
  const apa = { synthetic: true, mm, report: { opening: 'Synthetic opening.' } };
  return { person: { synthetic: true, slug, mm, name: slug, sport: 'Synthetic sport' },
    bos: { ...bos, artifact_sha256: hash(bos) }, apa: { ...apa, artifact_sha256: hash(apa) },
    bos_source: { answers: [] } };
}
const bundles = { nia: report('nia'), sofia: report('sofia') };
const output = (reply = 'Let us talk about what you noticed.') =>
  ({ reply, plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: '' });
const capture = (role, subject, text) => ({ subject, role,
  source: role === 'coach' ? 'Coach Alex (synthetic)' : `${bundles[subject].person.name} (synthetic)`,
  kind: 'text', text, attachments: [], reviewed: true,
  ...(role === 'coach' ? { channel: 'coach_connect_box04_v1' } : {}) });
function fixture(coach) {
  const redis = new FakeRedis();
  const store = createStore({ redis, bundles, scopeId: 'synthetic-leadership-demo-only',
    localAction: applyLiveCapture, coach });
  return { redis, store };
}
async function act(store, slug, body) {
  const state = await store.read(slug);
  return store.act(slug, { ...body, revision: state.revision, requestId: randomUUID() });
}

test('handoff eligibility revalidates exact synthetic subject, MM, source and bridge', () => {
  const state = initial(bundles.nia);
  const note = { id: 'note-nia', text: 'Coach Alex noticed a practice moment.', at: '2026-09-24T00:00:00.000Z',
    capture: { contract: 'athlete_capture_demo_v1', bridge: 'darren_demo_same_scope_v1',
      channel: 'coach_connect_box04_v1', reviewed: true, kind: 'text', attachments: [],
      subject: 'nia', role: 'coach', source: 'Coach Alex (synthetic)' } };
  state.messages.push(note);
  assert.deepEqual(pendingCoachNoteIds(state, bundles.nia), ['note-nia']);
  assert.deepEqual(pendingCoachNoteIds(state, bundles.sofia), []);
  assert.deepEqual(pendingCoachNoteIds(state, { ...bundles.nia, person: { ...bundles.nia.person, synthetic: false } }), []);
  assert.deepEqual(pendingCoachNoteIds(state, { ...bundles.nia, bos: { ...bundles.nia.bos, synthetic: false } }), []);
  for (const captureChange of [{ subject: 'sofia' }, { source: 'Real coach' }, { bridge: 'other' },
    { channel: 'legacy_consulting' }, { reviewed: false }, { kind: 'photo' },
    { attachments: [{ mime: 'image/png', sha256: 'a'.repeat(64) }] }, { role: 'athlete' }]) {
    state.messages[0].capture = { ...note.capture, ...captureChange };
    assert.deepEqual(pendingCoachNoteIds(state, bundles.nia), []);
  }
});

test('older-than-50 reviewed coach note reaches only the next successful opening, with metadata receipt', async () => {
  const calls = [];
  const { store } = fixture(async (bundle, state, task) => {
    calls.push({ task, conversation: coachingInput(bundle, state, task).conversation });
    return output();
  });
  let state = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'Notice the reset after a missed pass.') });
  const noteId = state.messages.at(-1).id;
  for (let index = 0; index < 55; index++) {
    state = await act(store, 'nia', { action: 'capture_demo', capture: capture('athlete', 'nia', `Fictional diary ${index}.`) });
  }
  assert.equal(state.coachNoteHandoff.pending_count, 1);
  assert.deepEqual(state.coachNoteHandoff.pending_ids, [noteId]);
  assert.equal(JSON.stringify(state.coachNoteHandoff).includes('missed pass'), false);
  assert.equal((await store.read('sofia')).coachNoteHandoff.pending_count, 0);
  state = await act(store, 'nia', { action: 'start' });
  assert.equal(state.status, 'active');
  assert.equal(state.coachNoteHandoff.pending_count, 0);
  assert.deepEqual(state.coachNoteHandoff.last_opening.note_ids, [noteId]);
  assert.equal(calls[0].task, 'OPENING');
  assert.equal(calls[0].conversation.at(-1).id, noteId);
  assert.equal(calls[0].conversation.at(-1).coach_note_handoff, 'next_opening');
  assert.match(calls[0].conversation.at(-1).text, /missed pass/u);
  assert.equal(calls[0].conversation.at(-1).capture.attachments.length, 0);
  assert.equal(state.plan, null);
  assert.deepEqual(state.learning, []);
  state = await act(store, 'nia', { action: 'finish' });
  await act(store, 'nia', { action: 'start' });
  assert.equal(calls[1].conversation.some((message) => message.coach_note_handoff), false);
  assert.equal(calls[1].conversation.some((message) => message.id === noteId || message.text.includes('missed pass')), false);
  assert.equal((await store.read('nia')).events.filter((event) => event.type === 'coach_note_opened').length, 1);
});

test('a delivered note remains in the authenticated record but never re-enters model input', async () => {
  const calls = [];
  const { store } = fixture(async (bundle, state, task) => {
    calls.push({ task, conversation: coachingInput(bundle, state, task).conversation });
    return output();
  });
  let state = await act(store, 'nia', { action: 'capture_demo',
    capture: capture('coach', 'nia', 'Only for the next session: a fictional practice reset.') });
  const noteId = state.messages.at(-1).id;
  state = await act(store, 'nia', { action: 'start' });
  assert.equal(calls[0].conversation.some((message) => message.id === noteId && message.coach_note_handoff === 'next_opening'), true);
  assert.equal(state.messages.some((message) => message.id === noteId), true);
  await act(store, 'nia', { action: 'message', speaker: 'athlete', text: 'Let us discuss school.' });
  await act(store, 'nia', { action: 'close' });
  await act(store, 'nia', { action: 'finish' });
  state = await act(store, 'nia', { action: 'start' });
  for (const call of calls.slice(1)) {
    assert.equal(call.conversation.some((message) => message.id === noteId
      || message.text.includes('Only for the next session')), false, call.task);
  }
  assert.equal(state.messages.some((message) => message.id === noteId), true);
  assert.deepEqual(state.coachNoteHandoff.last_opening.note_ids, [noteId]);
  assert.equal(state.events.filter((event) => event.type === 'coach_note_opened').length, 1);
});

test('a caller-chosen capture ID cannot relabel an older non-coach message as a handoff', async () => {
  const calls = [];
  const { store } = fixture(async (bundle, state, task) => {
    calls.push({ task, conversation: coachingInput(bundle, state, task).conversation });
    return output();
  });
  let state = await act(store, 'nia', { action: 'start' });
  const priorAssistant = state.messages.at(-1);
  state = await act(store, 'nia', { action: 'finish' });
  state = await store.act('nia', { action: 'capture_demo', revision: state.revision,
    requestId: priorAssistant.id, capture: capture('coach', 'nia', 'A reviewed Nia-only note.') });
  assert.equal(state.coachNoteHandoff.pending_count, 1);
  state = await act(store, 'nia', { action: 'start' });
  const opening = calls.at(-1).conversation;
  assert.equal(opening.filter((message) => message.coach_note_handoff === 'next_opening').length, 1);
  assert.equal(opening.find((message) => message.role === 'assistant' && message.id === priorAssistant.id)?.coach_note_handoff, undefined);
  assert.equal(opening.find((message) => message.capture?.channel === 'coach_connect_box04_v1')?.text.includes('Nia-only note'), true);
  assert.equal(state.messages.filter((message) => message.id === priorAssistant.id).length, 2);
});

test('a coach note saved mid-session is withheld from CHAT and CLOSE until the next OPENING', async () => {
  const calls = [];
  const { store } = fixture(async (bundle, state, task) => {
    calls.push({ task, conversation: coachingInput(bundle, state, task).conversation });
    return output(task === 'CLOSE' ? 'A closing summary.' : 'A response.');
  });
  await act(store, 'nia', { action: 'start' });
  const captured = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'Please ask about the practice reset next time.') });
  const noteId = captured.messages.at(-1).id;
  await act(store, 'nia', { action: 'message', text: 'I am talking about school today.', speaker: 'athlete' });
  await act(store, 'nia', { action: 'close' });
  assert.equal(calls[1].conversation.some((message) => message.id === noteId), false);
  assert.equal(calls[2].conversation.some((message) => message.id === noteId), false);
  assert.equal((await store.read('nia')).coachNoteHandoff.pending_count, 1);
  await act(store, 'nia', { action: 'finish' });
  const opened = await act(store, 'nia', { action: 'start' });
  assert.equal(calls[3].conversation.some((message) => message.id === noteId && message.coach_note_handoff === 'next_opening'), true);
  assert.equal(opened.coachNoteHandoff.pending_count, 0);
  assert.equal(opened.plan, null);
});

test('failed opening retains pending note for a later successful opening', async () => {
  let openings = 0;
  const { store } = fixture(async (_bundle, _state, task) => {
    if (task === 'OPENING' && openings++ === 0) throw new Error('COACH_CONNECTION_UNAVAILABLE');
    return output();
  });
  let state = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'A reviewed synthetic note.') });
  const noteId = state.messages.at(-1).id;
  state = await act(store, 'nia', { action: 'start' });
  assert.equal(state.status, 'ready');
  assert.equal(state.coachNoteHandoff.pending_count, 1);
  assert.equal(state.coachNoteHandoff.last_opening, null);
  state = await act(store, 'nia', { action: 'start' });
  assert.equal(state.status, 'active');
  assert.deepEqual(state.coachNoteHandoff.last_opening.note_ids, [noteId]);
  assert.equal(state.events.filter((event) => event.type === 'coach_note_opened').length, 1);
});

test('coach-note opening cannot retire a pending draft or stage learning from model output', async () => {
  const proposal = { title: 'Synthetic next step', why: 'A fictional practice choice.',
    steps: [{ action: 'Pause after a missed pass.', when: 'At practice.',
      notice: 'A calmer reset.', owner: 'athlete' }], review: 'Next session.' };
  const { store } = fixture(async () => ({ ...output(), plan: proposal,
    retire_draft: true, learning: ['Coach observation is now a preference.'] }));
  let state = await act(store, 'nia', { action: 'draft', plan: proposal });
  const originalDraft = structuredClone(state.draft);
  state = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'A reviewed fictional reset note.') });
  state = await act(store, 'nia', { action: 'start' });
  assert.deepEqual(state.draft, originalDraft);
  assert.equal(state.plan, null);
  assert.deepEqual(state.learning, []);
  assert.deepEqual(state.suggestedLearning, []);
  assert.equal(state.coachNoteHandoff.pending_count, 0);
});

test('unknown opening outcome cannot consume a pending note or call the model again automatically', async () => {
  let calls = 0, losePendingAck = true;
  const { redis, store } = fixture(async () => { calls++; return output(); });
  const captured = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'Wait for my next opening.') });
  const noteId = captured.messages.at(-1).id;
  const execute = redis.eval.bind(redis);
  redis.eval = async (script, count, ...args) => {
    const result = await execute(script, count, ...args);
    if (script === PERSIST_LUA && losePendingAck
      && JSON.parse(args[count + 1]).state.status === 'working') {
      losePendingAck = false;
      throw new Error('Simulated pending acknowledgement loss');
    }
    return result;
  };
  await assert.rejects(() => act(store, 'nia', { action: 'start' }), /pending acknowledgement loss/u);
  const recovered = await store.read('nia');
  assert.equal(recovered.status, 'ready');
  assert.equal(recovered.coachNoteHandoff.pending_count, 1);
  assert.deepEqual(recovered.coachNoteHandoff.pending_ids, [noteId]);
  assert.equal(recovered.coachNoteHandoff.last_opening, null);
  assert.equal(calls, 0);
});

test('lost final acknowledgement after a successful opening replays its single durable receipt', async () => {
  let calls = 0, loseFinalAck = true;
  const { redis, store } = fixture(async () => { calls++; return output(); });
  const captured = await act(store, 'nia', { action: 'capture_demo', capture: capture('coach', 'nia', 'Discuss this synthetic note.') });
  const noteId = captured.messages.at(-1).id;
  const body = { action: 'start', revision: captured.revision, requestId: 'opening-with-lost-ack' };
  const execute = redis.eval.bind(redis);
  redis.eval = async (script, count, ...args) => {
    const result = await execute(script, count, ...args);
    if (script === PERSIST_LUA && loseFinalAck) {
      const next = JSON.parse(args[count + 1]);
      if (next.operations[body.requestId]?.status === 'completed') {
        loseFinalAck = false;
        throw new Error('Simulated final acknowledgement loss');
      }
    }
    return result;
  };
  await assert.rejects(() => store.act('nia', body), /final acknowledgement loss/u);
  const reloaded = await store.read('nia');
  assert.equal(reloaded.status, 'active');
  assert.equal(reloaded.coachNoteHandoff.pending_count, 0);
  assert.deepEqual(reloaded.coachNoteHandoff.last_opening.note_ids, [noteId]);
  assert.equal(calls, 1);
  assert.deepEqual(await store.act('nia', body), reloaded);
  assert.equal(calls, 1);
  assert.equal(reloaded.events.filter((event) => event.type === 'coach_note_opened').length, 1);
});
