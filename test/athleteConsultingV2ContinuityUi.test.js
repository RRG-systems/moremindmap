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
  summarizeApaChanges } from '../src/athleteConsultingV2/continuityModel.js';

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

const bundle = { apa: { sources: [
  { id: 'A1', source: 'Athlete', question: 'Training days?' },
  { id: 'C1', source: 'Coach', question: 'Coach note?' },
] } };
const athleteMessage = { id: 'm1', role: 'user', speaker: 'athlete', text: 'My schedule changed.' };
const state = { flagship_enabled: true, messages: [
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
