import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { selectCoachNoteHandoff } from '../src/athleteConsultingV2/coachNoteHandoff.js';

const bundle = { person: { synthetic: true, slug: 'nia', mm: 'MM-NIA', name: 'Nia Brooks' } };
const capture = (id, subject = 'nia', changes = {}) => ({
  id, text: 'Reviewed fictional note',
  capture: { contract: 'athlete_capture_demo_v1', bridge: 'darren_demo_same_scope_v1',
    channel: 'coach_connect_box04_v1', reviewed: true, kind: 'text', attachments: [],
    role: 'coach', source: 'Coach Alex (synthetic)', subject, ...changes },
});

test('authenticated handoff UI reads only selected synthetic athlete reviewed source messages', () => {
  const state = { mm: 'MM-NIA', messages: [
    capture('nia-pending'), capture('sofia-note', 'sofia'),
    capture('wrong-source', 'nia', { source: 'Someone else' }),
    capture('wrong-bridge', 'nia', { bridge: 'other' }),
    capture('wrong-channel', 'nia', { channel: undefined }),
    capture('nia-delivered'),
  ], coachNoteHandoff: { pending_ids: ['nia-pending', 'sofia-note', 'wrong-source', 'wrong-bridge', 'wrong-channel'],
    last_opening: { note_ids: ['nia-delivered', 'sofia-note'], at: '2026-09-24T10:00:00.000Z' } } };
  const selected = selectCoachNoteHandoff(bundle, state);
  assert.deepEqual(selected.pending.map(({ id }) => id), ['nia-pending']);
  assert.deepEqual(selected.lastOpening.map(({ id }) => id), ['nia-delivered']);
  assert.equal(selected.deliveredAt, '2026-09-24T10:00:00.000Z');
});

test('handoff UI shows no notes for mismatched identity or non-synthetic athlete', () => {
  const state = { mm: 'MM-NIA', messages: [capture('nia-pending')],
    coachNoteHandoff: { pending_ids: ['nia-pending'] } };
  assert.deepEqual(selectCoachNoteHandoff({ person: { ...bundle.person, synthetic: false } }, state),
    { pending: [], lastOpening: [] });
  assert.deepEqual(selectCoachNoteHandoff(bundle, { ...state, mm: 'MM-SOFIA' }),
    { pending: [], lastOpening: [] });
  assert.deepEqual(selectCoachNoteHandoff({ person: { ...bundle.person, slug: 'real-athlete' } }, state),
    { pending: [], lastOpening: [] });
});

test('rendered athlete handoff names the pending and delivered receipt without showing a crossed note', async (context) => {
  const vite = await createServer({ cacheDir: path.join(os.tmpdir(), 'athlete-coach-note-ui-vite'),
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  context.after(() => vite.close());
  const { default: CoachNoteHandoff } = await vite.ssrLoadModule('/src/athleteConsultingV2/CoachNoteHandoff.jsx');
  const state = { mm: 'MM-NIA', messages: [
    { ...capture('nia-pending'), text: 'Nia-only practice note' },
    { ...capture('nia-delivered'), text: 'Nia-only delivered note' },
    { ...capture('sofia-note', 'sofia'), text: 'Private Sofia note' },
  ], coachNoteHandoff: { pending_ids: ['nia-pending', 'sofia-note'],
    last_opening: { note_ids: ['nia-delivered'], at: '2026-09-24T10:00:00.000Z' } } };
  const html = renderToStaticMarkup(React.createElement(CoachNoteHandoff, { bundle, state }));
  assert.match(html, /Ready for your next session/);
  assert.match(html, /Given to MORE at session opening/);
  assert.match(html, /Nia-only practice note/);
  assert.match(html, /Nia-only delivered note/);
  assert.doesNotMatch(html, /Private Sofia note/);
  assert.match(html, /does not change the BOS, APA, approved learning, or the plan/);
});
