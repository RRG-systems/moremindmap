import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { eligibleAthleteMessages, selectableApaSources,
  summarizeApaChanges, APA_NO_CHANGE_TITLE } from '../src/athleteConsultingV2/continuityModel.js';

const compiler = await createServer({ configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: path.join(os.tmpdir(), `athlete-continuity-render-${process.pid}`),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let AthleteContinuity, AthleteMessageActions;
try {
  ({ default: AthleteContinuity, AthleteMessageActions } = await compiler.ssrLoadModule(
    '/src/athleteConsultingV2/AthleteContinuity.jsx'));
} finally { await compiler.close(); }

const bundle = { person: { mm: 'MM-FICTIONAL-REVIEW' }, apa: { artifact_sha256: 'a'.repeat(64), sources: [
  { id: 'A1', source: 'Athlete', question: 'Training days?' },
  { id: 'C1', source: 'Coach', question: 'Coach note?' },
] } };
const athleteMessage = { id: 'm1', role: 'user', speaker: 'athlete', text: 'My schedule changed.' };
const state = { mm: bundle.person.mm, flagship_enabled: true, status: 'active', messages: [
  { id: 'coach', role: 'user', speaker: 'coach', text: 'I think the schedule changed.' },
  { id: 'capture', role: 'user', speaker: 'athlete', text: 'source-only capture', capture: {} },
  athleteMessage,
], personalMemory: { items: [] }, currentApa: null, apaDraft: null, apaNeedsReview: false };

test('only the selected athlete’s saved plain message can be offered for fact confirmation', () => {
  assert.deepEqual(eligibleAthleteMessages(state), [athleteMessage]);
  assert.equal(renderToStaticMarkup(React.createElement(AthleteMessageActions,
    { message: state.messages[0], onChoose: () => {} })), '');
  assert.equal(renderToStaticMarkup(React.createElement(AthleteMessageActions,
    { message: state.messages[1], onChoose: () => {} })), '');
  assert.match(renderToStaticMarkup(React.createElement(AthleteMessageActions,
    { message: athleteMessage, onChoose: () => {} })),
    /Use or correct this detail/u);
  assert.deepEqual(selectableApaSources(bundle, state).map((item) => item.id), ['A1']);
});

test('an unpublished draft stays visibly proposed with compact review and no automatic plan claim', () => {
  const draft = { id: 'draft', hash: 'hash', previewRecord: { version: 2,
    receipts: [{ material_paths: ['report.domains.sport.goal', 'report.futures.future.what',
      'move.selection'] }] } };
  assert.deepEqual(summarizeApaChanges(draft), ['Your four areas', 'Five Futures', 'One Move options']);
  const html = renderToStaticMarkup(React.createElement(AthleteContinuity,
    { bundle, state: { ...state, apaDraft: draft }, onAction: async () => {}, onNavigate: () => {} }));
  assert.match(html, /A proposed APA update is ready/u);
  assert.match(html, /Read the proposed APA/u);
  assert.match(html, /Decide on this version/u);
  assert.doesNotMatch(html, /Publish this exact APA version|YOUR CURRENT PLAN/u);
});

test('a correction warns that the prior map is historical rather than current evidence', () => {
  const html = renderToStaticMarkup(React.createElement(AthleteContinuity,
    { bundle, state: { ...state, apaNeedsReview: true }, onAction: async () => {}, onNavigate: () => {} }));
  assert.match(html, /Your APA needs another look/u);
  assert.match(html, /not current evidence/u);
  assert.match(html, /Review a correction for your APA/u);
  assert.doesNotMatch(html, /updated automatically/u);
});

test('saved no-change result survives reload as honest feedback, never a phantom proposal', () => {
  const saved = { ...state, events: [{ type: 'current_apa_no_change', version: 0,
    content_hash: bundle.apa.artifact_sha256, source_message_id: athleteMessage.id,
    request_id: 'fictional-request' }] };
  for (const reading of [saved, JSON.parse(JSON.stringify(saved))]) {
    const html = renderToStaticMarkup(React.createElement(AthleteContinuity,
      { bundle, state: reading, onAction: async () => {}, onNavigate: () => {} }));
    assert.ok(html.includes(APA_NO_CHANGE_TITLE));
    assert.match(html, /role="status".*Last APA preparation result/u);
    assert.match(html, /requested change has not been published/u);
    assert.match(html, /saved APA and agreed plan are unchanged/u);
    assert.match(html, /No explanation was returned/u);
    assert.doesNotMatch(html, /A proposed APA update is ready|Read the proposed APA|Decide on this version|change was rejected/u);
  }
});

test('another athlete or a failed/unresolved/newer APA action never borrows old no-change feedback', () => {
  const event = { type: 'current_apa_no_change', version: 0, content_hash: bundle.apa.artifact_sha256,
    source_message_id: athleteMessage.id, request_id: 'fictional-request' };
  for (const changes of [{ mm: 'OTHER-MM' }, { status: 'working' }, { lastError: 'Composition failed' },
    { events: [event, { type: 'current_apa_published' }] }]) {
    const html = renderToStaticMarkup(React.createElement(AthleteContinuity,
      { bundle, state: { ...state, events: [event], ...changes }, onAction: async () => {}, onNavigate: () => {} }));
    assert.ok(!html.includes(APA_NO_CHANGE_TITLE));
  }
});
