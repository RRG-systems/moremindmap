import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const compiler = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: path.join(os.tmpdir(), `athlete-visual-render-${process.pid}`),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
let AthleteVisual;
try {
  AthleteVisual = (await compiler.ssrLoadModule('/src/athleteConsultingV2/AthleteVisual.jsx')).default;
} finally {
  await compiler.close();
}

const plan = {
  event: 'SESSION_FINALIZATION',
  renderDecision: { render: true },
  guidance: { eyebrow: 'BEFORE YOU GO', headline: 'What we learned today',
    summary: 'Your conversation is saved.', nextCue: 'Review any proposal before it becomes your plan.' },
  blocks: [{ blockId: 'athlete-block-recap', type: 'COMMITMENTS', title: 'What to carry forward',
    subtitle: 'A review, not a new agreement', objects: [
      { id: 'athlete-map-change', kind: 'MAP_CHANGE_REVEAL', title: 'This is how your map has changed',
        statement: 'The saved APA did not change this session.', sourceIds: ['athlete-source-map-start'],
        items: [{ label: 'Saved APA', value: 'Version 0 → 0', note: 'No published APA change this session.' }] },
      { id: 'athlete-session-recap', kind: 'SESSION_RECAP', title: 'Before you go',
        statement: 'You discussed a practice option but made no commitment.', sourceIds: ['athlete-source-session-recap'] },
      { id: 'athlete-draft', kind: 'PROPOSED_PLAN', title: 'For your review',
        statement: 'A possible two-step plan', qualifier: 'This proposal has not changed the agreed plan.',
        sourceIds: ['athlete-source-draft'], items: [
          { label: 'Try one drill', value: 'On Tuesday', note: 'Athlete · Notice energy after practice' },
        ] },
    ], evidence: [{ id: 'athlete-source-map-start', label: 'Session-start saved map' },
      { id: 'athlete-source-session-recap', label: 'Current unconfirmed closing review' },
      { id: 'athlete-source-draft', label: 'Unapproved plan proposal' }] }],
};

test('rendered closing visual keeps source and draft boundary while containing no action controls', () => {
  const before = structuredClone(plan);
  const html = renderToStaticMarkup(React.createElement(AthleteVisual, { plan }));
  assert.match(html, /What we learned today/u);
  assert.match(html, /This is how your map has changed/u);
  assert.match(html, /No published APA change this session/u);
  assert.match(html, /You discussed a practice option but made no commitment/u);
  assert.match(html, /Not yet agreed/u);
  assert.match(html, /Current unconfirmed closing review/u);
  assert.match(html, /Unapproved plan proposal/u);
  assert.match(html, /does not approve a plan or rewrite your assessment/u);
  assert.doesNotMatch(html, /<button|<form|<input/u);
  assert.deepEqual(plan, before);
  assert.equal(renderToStaticMarkup(React.createElement(AthleteVisual, {
    plan: { ...plan, renderDecision: { render: false } },
  })), '');
});
