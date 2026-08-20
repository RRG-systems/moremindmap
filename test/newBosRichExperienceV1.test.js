import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {
  SYNTHETIC_FIXTURES,
  buildPersonalityDnaRuntime,
  buildVisualBosModel,
} from '../src/lib/newBosPersonalityDnaV1/index.js';

const root = process.cwd();
const artifacts = SYNTHETIC_FIXTURES.map((fixture) => buildPersonalityDnaRuntime(fixture));

test('Visual BOS models remain distinct and add meaning beyond the contour', () => {
  const models = artifacts.map(buildVisualBosModel);
  assert.equal(new Set(models.map(({ operating_core: core }) => core)).size, 4);
  models.forEach((model) => {
    assert.ok(model.primary_pattern);
    assert.ok(model.secondary_pattern);
    assert.ok(model.tertiary_pattern);
    assert.ok(model.operating_loop.length >= 3);
    assert.equal(model.futures.length, 5);
    assert.ok(model.one_move);
    assert.match(model.evidence_boundary, /not a prediction/i);
  });
});

test('rich Visual BOS includes inputs, outputs, pressure, recovery, environment, signals and One Move', () => {
  const artifact = artifacts.find(({ subject_token: token }) => token === 'SYNTH-PDNV1-MOSAIC');
  const model = buildVisualBosModel(artifact);
  assert.equal(model.inputs.length, 4);
  assert.equal(model.outputs.length, 4);
  ['pressure_shift', 'recovery_path', 'energy_source', 'fatigue_source', 'environment_fit', 'environment_risk', 'transfer_gap', 'one_move']
    .forEach((field) => assert.ok(model[field], field));
  assert.ok(model.signals.length >= 4);
});

test('experience source provides annotated map, responsive navigation and fullscreen Visual BOS controls', async () => {
  const source = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosExperience.jsx`, 'utf8');
  const visual = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosVisualBos.jsx`, 'utf8');
  assert.match(source, /personality-dna-map/);
  assert.match(source, /nbos-map-label/);
  assert.match(source, /PRIOR_BAND_LABELS/);
  assert.match(source, /Choose a destination/);
  assert.match(visual, /visual-bos-preview/);
  assert.match(visual, /visual-bos-fullscreen/);
  assert.match(visual, /Expand full Visual BOS/);
  assert.doesNotMatch(visual, /<p>\{model\.core_explanation\}<\/p>/);
  assert.doesNotMatch(source + visual, /DeterministicBOSDNAVisualV2/);
});

test('production customer mode removes synthetic lab framing without changing the governed experience', async () => {
  const experience = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosExperience.jsx`, 'utf8');
  const route = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosProductionCanary.jsx`, 'utf8');
  assert.match(route, /customerMode=\{customerMode\}/);
  assert.match(experience, /customerMode \? 'Your governed Personality DNA'/);
  assert.match(experience, /customerMode \? null : privateGate \?/);
  assert.match(experience, /Synthetic product lab/);
  assert.match(experience, /Synthetic fixture selector/);
});

test('Validation bottom accurately presents the bounded BA to optional Subscription path', async () => {
  const source = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosExperience.jsx`, 'utf8');
  assert.match(source, /Your BOS is our best current understanding of you\./);
  assert.match(source, /Next, your Business Assessment can connect who you are with how your business actually operates\./);
  assert.match(source, /If you choose MORE Subscription after your Business Assessment, you will have the opportunity/);
  assert.match(source, /future evidence can confirm, refine, or challenge/);
  assert.doesNotMatch(source, /automatically updates|will automatically|already learns from real life/i);
});

test('purpose-specific renderer inventory covers all fifteen surface IDs', async () => {
  const source = await readFile(`${root}/src/components/newBosPersonalityDnaV1/NewBosExperience.jsx`, 'utf8');
  const richSwitch = source.slice(source.indexOf('function RichSurface'), source.indexOf('function Surface('));
  const matches = [...richSwitch.matchAll(/case '([^']+)'/g)].map((match) => match[1]);
  assert.equal(matches.length, 15);
  assert.equal(new Set(matches).size, 15);
});

test('responsive CSS includes tablet, mobile and narrow-mobile layouts without scroll-only navigation', async () => {
  const css = await readFile(`${root}/src/components/newBosPersonalityDnaV1/newBosExperience.css`, 'utf8');
  assert.match(css, /@media \(max-width: 1020px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /\.nbos-nav-select \{ display: grid/);
  assert.doesNotMatch(css, /\.nbos-nav[^\n]*overflow-x:\s*auto/);
});
