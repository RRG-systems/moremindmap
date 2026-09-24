import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLiveCapture } from '../server/athleteConsultingV2/capture.js';
import { initial } from '../server/athleteConsultingV2/state.js';

const bundle = { person: { synthetic: true, slug: 'nia', mm: 'MM-NIA', name: 'Nia Brooks' } };
const coachNote = { subject: 'nia', role: 'coach', source: 'Coach Alex (synthetic)',
  kind: 'text', text: 'Reviewed fictional practice note.', attachments: [], reviewed: true,
  channel: 'coach_connect_box04_v1' };
const save = (state, capture) => applyLiveCapture(state,
  { action: 'capture_demo', requestId: 'synthetic-note-1', capture }, bundle);

test('Coach Connect persists the reviewed provenance marker only for text-only Coach Alex notes', () => {
  const state = initial(bundle);
  save(state, coachNote);
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].capture.channel, 'coach_connect_box04_v1');
  assert.equal(state.messages[0].capture.reviewed, true);
  assert.equal(state.messages[0].capture.bridge, 'darren_demo_same_scope_v1');
  assert.deepEqual(state.messages[0].capture.attachments, []);
});

test('Coach Connect rejects unreviewed, wrong-role, media-bearing and forged channel captures before mutation', () => {
  for (const capture of [
    { ...coachNote, reviewed: false },
    { ...coachNote, role: 'athlete', source: 'Nia Brooks (synthetic)' },
    { ...coachNote, kind: 'voice' },
    { ...coachNote, attachments: [{ mime: 'audio/mp4', data: 'AAAA' }] },
    { ...coachNote, channel: 'other' },
  ]) {
    const state = initial(bundle);
    assert.throws(() => save(state, capture));
    assert.equal(state.messages.length, 0);
  }
});

test('legacy Consulting capture remains available without gaining Coach Connect handoff provenance', () => {
  const state = initial(bundle);
  save(state, { ...coachNote, channel: undefined });
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].capture.channel, undefined);
  assert.equal(state.messages[0].capture.reviewed, undefined);
});
