import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from './helpers/inMemoryRenderCompiler.mjs';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };

const compiler = await createServer({ configFile: false,
  root: fileURLToPath(new URL('../', import.meta.url)),
  cacheDir: path.join(os.tmpdir(), `athlete-apa-currency-render-${process.pid}`),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
let ReportPage, Apa;
try {
  ReportPage = (await compiler.ssrLoadModule('/src/athleteConsultingV2/approved-apa/ReportPage.jsx')).default;
  ({ Apa } = await compiler.ssrLoadModule('/src/athleteConsultingV2/Reports.jsx'));
} finally { await compiler.close(); }

const renderMove = overrides => renderToStaticMarkup(React.createElement(ReportPage,
  { active: 'move', a: nia.apa, openObject: () => {}, navigate: () => {}, ...overrides }));

test('old One Move is explicitly historical after a correction and never presented as current', () => {
  const html = renderMove({ needsReview: true });
  assert.match(html, /historical and awaiting a reviewed APA update/u);
  assert.match(html, /Do not treat it as a current recommendation/u);
});

test('a failed refresh labels the last verified One Move as currency-unconfirmed', () => {
  const html = renderMove({ stale: true });
  assert.match(html, /last verified suggestion/u);
  assert.match(html, /currency is unconfirmed/u);
});

test('the proposed-APA navigation target loads the iframe directly in preview mode', () => {
  const html = renderToStaticMarkup(React.createElement(Apa,
    { bundle: nia, reading: 'preview', onDiscuss: () => {}, onPlan: () => {} }));
  assert.match(html, /reading=preview/u);
  assert.match(html, /athlete=nia/u);
});
