import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import React from 'react';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from './helpers/inMemoryRenderCompiler.mjs';
import { athleteChatTextBlocks } from '../src/athleteConsultingV2/chatText.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const comparison = [
  '### Two paths from the current Five Futures',
  '',
  '```text',
  'Current course    ->    Notice one cue',
  '       |                     |',
  '   no new step          existing team drill',
  '```',
  '',
  '| Possibility | What Sofia could notice |',
  '| --- | --- |',
  '| **Try one cue** | Whether it helps in the existing drill |',
  '| Do nothing new | Whether the first pass still feels hesitant |',
  '',
  '- These are possibilities, not outcomes.',
  '1. Sofia chooses what to try.',
].join('\n');

test('actual failed CHAT13 shape becomes a heading, whitespace-preserved diagram, table and lists', () => {
  const before = comparison;
  const blocks = athleteChatTextBlocks(comparison);
  assert.equal(comparison, before, 'saved/model reply bytes remain unchanged');
  assert.deepEqual(blocks.map(block => block.kind), [
    'heading', 'code', 'table', 'unordered', 'ordered',
  ]);
  assert.equal(blocks[0].level, 3);
  assert.equal(blocks[1].complete, true);
  assert.equal(blocks[1].text, 'Current course    ->    Notice one cue\n       |                     |\n   no new step          existing team drill');
  assert.deepEqual(blocks[2].header, ['Possibility', 'What Sofia could notice']);
  assert.equal(blocks[2].rows.length, 2);
  assert.equal(blocks[2].rows[0][0], '**Try one cue**');
});

test('plain chat, heading levels, ordered labels, CRLF and malformed text retain readable fallback', () => {
  assert.deepEqual(athleteChatTextBlocks('One\r\nTwo\r\n\r\n3. Third\r\n5. Fifth'), [
    { kind: 'paragraph', lines: ['One', 'Two'] },
    { kind: 'ordered', items: [{ number: 3, lines: ['Third'] }, { number: 5, lines: ['Fifth'] }] },
  ]);
  assert.deepEqual(athleteChatTextBlocks('###Not a heading\n| a | b |\n| no | separator |'), [
    { kind: 'paragraph', lines: ['###Not a heading', '| a | b |', '| no | separator |'] },
  ]);
  assert.deepEqual(athleteChatTextBlocks('```text\n  <script>private()</script>'), [
    { kind: 'code', text: '```text\n  <script>private()</script>', complete: false },
  ]);
  assert.deepEqual(athleteChatTextBlocks(null), []);
});

test('both actual chat/history sites use one assistant-only renderer without changing closing or message actions', () => {
  const demo = read('src/athleteConsultingV2/App.jsx');
  const main = read('src/athleteAcademyV1/coach/App.jsx');
  assert.match(demo, /m\.role==='assistant'\?<AthleteChatText value=\{m\.text\}/u);
  assert.match(main, /m\.role === 'assistant' \? <AthleteChatText value=\{m\.text\}/u);
  assert.match(demo, /<AthleteMessageActions message=\{m\}/u);
  assert.match(demo, /<AthleteText value=\{s\.closing\.summary\}/u);
  assert.match(read('src/athleteAcademyV1/coach/ClosingReview.jsx'), /<AthleteText value=\{state\.closing\.summary\}/u);
  const component = read('src/athleteConsultingV2/AthleteChatText.jsx');
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|innerHTML|DOMParser|eval\(|<a\b|<img\b/u);
  const css = read('src/athleteConsultingV2/athlete-chat-text.css');
  assert.match(css, /white-space:pre;/u);
  assert.match(css, /overflow-x:auto/u);
  assert.match(css, /max-width:100%/u);
});

test('rendered assistant comparison is semantic, escaped and scrollable without raw Markdown controls', async context => {
  const vite = await createServer({ configFile: false, envFile: false, plugins: [react()],
    cacheDir: path.join(os.tmpdir(), 'athlete-chat-readable-vite'),
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'silent' });
  context.after(() => vite.close());
  const { default: ChatText } = await vite.ssrLoadModule('/src/athleteConsultingV2/AthleteChatText.jsx');
  const html = renderToStaticMarkup(React.createElement(ChatText, { value: comparison }));
  assert.match(html, /<h3>Two paths from the current Five Futures<\/h3>/u);
  assert.match(html, /<pre><code>Current course {4}-&gt; {4}Notice one cue/u);
  assert.match(html, /<table><thead><tr><th scope="col">Possibility<\/th>/u);
  assert.match(html, /<strong>Try one cue<\/strong>/u);
  assert.match(html, /<ul><li>/u);
  assert.match(html, /<ol start="1"><li value="1">/u);
  assert.doesNotMatch(html, /```|###|\| --- \|/u);
  const unsafe = renderToStaticMarkup(React.createElement(ChatText, { value:
    '### <script>alert(1)</script>\n\n```text\n<img src=x onerror=alert(1)>\n```\n\n| Name | Value |\n| --- | --- |\n| <svg onload=alert(1)> | [click](javascript:alert(1)) |' }));
  assert.doesNotMatch(unsafe, /<script>|<img|<svg|<a\b/u);
  assert.match(unsafe, /&lt;script&gt;/u);
  assert.match(unsafe, /&lt;img src=x/u);
  assert.match(unsafe, /&lt;svg onload/u);
  assert.match(unsafe, /\[click\]\(javascript:alert\(1\)\)/u);
});
