import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import React from 'react';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('authenticated narrative review renders exact string/array before-after and truthful provenance', async context => {
  const vite = await createServer({ configFile: false, envFile: false, plugins: [react()],
    cacheDir: path.join(os.tmpdir(), 'athlete-narrative-ui-vite'),
    server: { middlewareMode: true, watch: null, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'silent' });
  context.after(() => vite.close());
  const { default: Component } = await vite.ssrLoadModule('/src/athleteConsultingV2/ApaNarrativeChanges.jsx');
  const change = (field, before, after, extra = {}) => ({ field, path: `report.${field}`,
    before, after, before_refs: null, after_refs: ['APA:CURRENT:11111111-1111-4111-8111-111111111111'],
    value_changed: true, reference_changed: true, version: 1,
    prior_provenance: 'BASELINE_FIELD_UNCITED', ...extra });
  const receipt = { narrative_changes: [
    change('opening', 'Library time is protected for the draft.', 'The draft is submitted; the week now makes room for Friday practice.'),
    change('what_we_dont_know', ['Whether the draft is finished.'], ['Whether the Friday cue will help.', 'Whether rehearsal timing stays stable.']),
    change('headline', 'One whole journey', 'One whole journey', { value_changed: false }),
  ] };
  const render = props => renderToStaticMarkup(React.createElement(Component, { receipt, ...props }));
  const preview = render({ proposed: true });
  assert.match(preview, /PROPOSED WHOLE-PICTURE UPDATE · NOT SAVED/u);
  assert.match(preview, /Library time is protected for the draft/u);
  assert.match(preview, /The draft is submitted/u);
  assert.match(preview, /<li>Whether the Friday cue will help\.<\/li>/u);
  assert.match(preview, /<li>Whether rehearsal timing stays stable\.<\/li>/u);
  assert.match(preview, /No earlier citation has been invented/u);
  assert.match(preview, /The value is unchanged\. Its supporting evidence is proposed for review\./u);
  assert.doesNotMatch(preview, /11111111|SAVED WHOLE-PICTURE UPDATE</u);
  const saved = render({ proposed: false });
  assert.match(saved, /SAVED WHOLE-PICTURE UPDATE/u);
  assert.match(saved, /exact changes you reviewed and published/u);
  assert.match(render({ historical: true }), /EARLIER WHOLE-PICTURE UPDATE · REVIEW NEEDED/u);
  assert.equal(renderToStaticMarkup(React.createElement(Component, { receipt: null })), '');
  const invalid = { narrative_changes: [change('opening', 'Before', ['Wrong type']),
    change('other_field', 'Before', 'After')] };
  assert.equal(renderToStaticMarkup(React.createElement(Component, { receipt: invalid })), '');
  const escaped = renderToStaticMarkup(React.createElement(Component, { receipt: {
    narrative_changes: [change('opening', 'Before', '<script>private()</script>')],
  } }));
  assert.doesNotMatch(escaped, /<script>/u);
  assert.match(escaped, /&lt;script&gt;/u);
});
