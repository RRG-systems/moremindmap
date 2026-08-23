import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../src/components/baProductionReadinessV1/newBaProductionCanary.css', import.meta.url);
const componentUrl = new URL('../src/lab/subscriptionLivingBusinessRelationshipV1/LivingBusinessTwinApp.jsx', import.meta.url);

test('Selected Future responds to its actual card width without changing Futures content', async () => {
  const [css, component] = await Promise.all([
    readFile(cssUrl, 'utf8'),
    readFile(componentUrl, 'utf8'),
  ]);

  assert.match(css, /container-name:\s*selected-future-card/u);
  assert.match(css, /container-type:\s*inline-size/u);
  assert.match(css, /@container selected-future-card \(max-width:\s*430px\)/u);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\) auto/u);
  assert.match(css, /\.future-confidence\s*\{\s*grid-column:\s*1 \/ -1/u);
  assert.match(css, /overflow-wrap:\s*anywhere/u);

  assert.match(component, /<h2>\{selected\.label\}<\/h2>/u);
  assert.match(component, /<strong>\{selected\.probability\}%<\/strong>/u);
  assert.match(component, /\{confidenceLevel\} confidence/u);
  assert.match(component, /selected\.summary/u);
  assert.match(component, /selected\.condition/u);
  assert.match(component, /selected\.supporting/u);
  assert.match(component, /selected\.falsifiers/u);
});
