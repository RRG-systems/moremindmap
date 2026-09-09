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
  cacheDir: path.join(os.tmpdir(), `subscription-s2-render-test-${process.pid}`),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
});
let Renderer;
try {
  Renderer = (await compiler.ssrLoadModule('/src/subscriptionS2/SubscriptionS2GuRenderer.jsx')).default;
} finally {
  await compiler.close();
}
const notes = {
  id: 's2-session-learning', kind: 'SESSION_LEARNING', statement: 'A short recap to carry into your next session.',
  items: ['What mattered', 'What changed', 'What we learned', 'What was decided', 'What remains open', 'What we will pick up next time']
    .map((label, index) => ({ label, value: `Complete synthetic note ${index}: discussion remains distinct from agreement.`, note: '' })),
};
const distinct = { id: 's2-question', kind: 'OPEN_LOOPS', statement: 'A distinct question remains unresolved.', items: [{ label: 'Question to revisit', value: 'Which time trade-off matters most?', note: '' }] };
function plan(event = 'SESSION_CLOSING') {
  return {
    event, renderDecision: { render: true }, guidance: { eyebrow: 'MORE', headline: 'Our session recap', summary: 'What to carry forward.', nextCue: 'We can revisit the open question next time.' },
    blocks: [
      { blockId: 'recap', type: 'PLAIN_LANGUAGE', title: 'What we are carrying forward', subtitle: 'Shared understanding', objects: [structuredClone(notes)] },
      { blockId: 'question', type: 'QUESTION', title: 'What should we revisit?', subtitle: 'The question is still open.', objects: [structuredClone(notes), structuredClone(distinct)] },
    ],
  };
}
const render = (value) => renderToStaticMarkup(React.createElement(Renderer, { plan: value }));
const occurrences = (html, text) => html.split(text).length - 1;

test('closing recap renders complete repeated notes once and preserves distinct card content and a working target', () => {
  const input = plan();
  const before = JSON.stringify(input);
  const html = render(input);
  for (const item of notes.items) assert.equal(occurrences(html, item.value), 1);
  for (const text of ['What we are carrying forward', 'What should we revisit?', 'The question is still open.', distinct.statement, distinct.items[0].value]) assert.ok(html.includes(text));
  const hrefs = [...html.matchAll(/href="#([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(hrefs.length, 1);
  assert.equal(occurrences(html, `id="${hrefs[0]}"`), 1);
  assert.ok(html.includes('View the session recap above'));
  assert.equal(JSON.stringify(input), before);
});

test('different note content remains inspectable even if a malformed plan reuses its object identity', () => {
  const input = plan();
  input.blocks[1].objects[0].items[0].value = 'A distinct later clarification must remain visible.';
  const html = render(input);
  assert.ok(html.includes(notes.items[0].value));
  assert.ok(html.includes('A distinct later clarification must remain visible.'));
  assert.equal(occurrences(html, 'View the session recap above'), 0);
});

test('deduplication is limited to closing session learning, preserving other objects and other events', () => {
  const ordinary = render(plan('COACHING_MOMENT'));
  assert.equal(occurrences(ordinary, notes.items[0].value), 2);
  const input = plan();
  input.blocks[0].objects.push(structuredClone(distinct));
  assert.equal(occurrences(render(input), distinct.statement), 2);
});

test('separate closing recaps receive separate anchor targets in the same conversation', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Renderer, { plan: plan() }), React.createElement(Renderer, { plan: plan() })));
  const hrefs = [...html.matchAll(/href="#([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(hrefs.length, 2);
  assert.equal(new Set(hrefs).size, 2);
  for (const href of hrefs) assert.equal(occurrences(html, `id="${href}"`), 1);
  assert.equal(render({ ...plan(), renderDecision: { render: false } }), '');
});
