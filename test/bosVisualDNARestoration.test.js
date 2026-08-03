import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildCustomerVisualDNAProjection,
  customerFacingDimensionLabel,
  VISUAL_DNA_PANEL_CLASSIFICATIONS,
} from '../src/lib/visualDNA/buildCustomerVisualDNAProjection.js';

function visualFixture() {
  const topDimensions = [
    {
      label: 'Vector', key: 'VEC', value: 0.91, evidence: 4, rationale: 'Vector is the leading measured tendency.',
    },
    { label: 'Flex', key: 'FLE', value: 0.76, evidence: 3 },
    { label: 'Signal', key: 'SIG', value: 0.63, evidence: 2 },
    { label: 'Fidelity', key: 'FID', value: 0.54, evidence: 2 },
    { label: 'Velocity', key: 'VEL', value: 0.42, evidence: 1 },
    { label: 'Framework', key: 'FRA', value: 0.31, evidence: 1 },
  ];
  return {
    profileId: 'mm-synthetic-visual-dna',
    name: 'Synthetic Reviewer',
    company: 'Example Company',
    type: 'Vector / Horizon',
    primaryEngine: 'Vector',
    secondaryEngine: 'Horizon',
    engineLabel: 'Vector + Horizon',
    systemType: 'Vector Perspective System',
    topDimensions,
    primaryDimension: topDimensions[0],
    secondaryDimension: topDimensions[1],
    tertiaryDimension: topDimensions[2],
    lowestDimension: topDimensions.at(-1),
    confidence: 'Moderate',
    amplitude: { score: 0.73, label: 'Moderate' },
    evidenceSummary: { strong: 2, moderate: 2, thin: 2, none: 0 },
    inputs: ['Vision', 'Context', 'Signal'],
    outputs: ['Decisions', 'Direction'],
    operatingLoop: ['Observe', 'Choose', 'Move', 'Review'],
    tension: {
      left: 'Vector',
      right: 'Flex',
      label: 'Direction / Flex tension',
      detail: 'Vector can compete with Flex under pressure.',
    },
    energySource: ['Clear direction', 'Visible movement'],
    fatigueSource: ['Repeated ambiguity', 'Slow loops'],
    bestEnvironment: ['Decision rights are clear'],
    worstEnvironment: ['Every decision needs consensus'],
    naturalAdvantage: 'Vector creates direction.',
    naturalRisk: 'Velocity can outrun shared understanding.',
    roleFitSignals: ['Builder', 'Team lead'],
    wrongSeatRisk: 'Moderate',
    futureBottleneck: 'A future outcome that is not sufficiently supported.',
    oneMove: 'Test one explicit decision rule.',
    roleTruth: 'This remains a hypothesis to test.',
    keySignals: ['Vector creates confidence', 'Signal improves context'],
    futureCards: [
      { title: 'Current Trajectory', likelihood: 'Likely', summary: 'Momentum rises while coordination cost grows.' },
      { title: 'Optimized Trajectory', likelihood: 'Possible', summary: 'Decision rules make speed scalable.' },
      { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Urgency becomes cleanup and rework.' },
      { title: 'Leadership Trajectory', likelihood: 'Possible', summary: 'Judgment becomes transferable.' },
      { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Growth routes back through the leader.' },
    ],
    customerPresentation: {
      globalLimitation: 'Legacy limitation.',
      visibility: {
        dimensionEvidence: true,
        evidenceAmplitude: true,
        energySource: false,
        fatigueSource: false,
        inputs: false,
        outputs: false,
        operatingLoop: false,
        coreTension: false,
        futureBottleneck: false,
        wrongSeatRisk: false,
        environments: false,
        oneMove: true,
        futureCards: false,
        keySignals: true,
        footer: false,
        roleFit: false,
      },
    },
  };
}

test('all seven legacy aliases map to customer-facing labels', () => {
  assert.deepEqual(
    ['Vector', 'Flex', 'Signal', 'Fidelity', 'Velocity', 'Framework', 'Horizon']
      .map(customerFacingDimensionLabel),
    ['Command', 'Adaptability', 'Relational Awareness', 'Precision', 'Tempo', 'Structure', 'Perspective'],
  );
});

test('customer projection restores supported depth without mutating score topology or source contracts', () => {
  const source = visualFixture();
  const before = structuredClone(source);
  const projection = buildCustomerVisualDNAProjection(source);

  assert.deepEqual(source, before);
  assert.deepEqual(
    projection.topDimensions.map(({ key, value, evidence }) => ({ key, value, evidence })),
    source.topDimensions.map(({ key, value, evidence }) => ({ key, value, evidence })),
  );
  assert.deepEqual(projection.topDimensions.map(({ label }) => label), [
    'Command',
    'Adaptability',
    'Relational Awareness',
    'Precision',
    'Tempo',
    'Structure',
  ]);
  assert.equal(projection.type, 'Command / Perspective');
  assert.equal(projection.primaryDimension.key, 'VEC');
  assert.equal(projection.primaryDimension.rationale, 'Command is the leading measured tendency.');
  assert.equal(projection.customerPresentation.version, 'visual-dna-restoration-v1');
  assert.deepEqual(
    projection.customerPresentation.panelClassifications,
    VISUAL_DNA_PANEL_CLASSIFICATIONS,
  );
});

test('measured, derived, hypothesis, and observation panels render while unsupported factual panels remain hidden', () => {
  const projection = buildCustomerVisualDNAProjection(visualFixture());
  const visibility = projection.customerPresentation.visibility;

  for (const key of [
    'dimensionEvidence',
    'evidenceAmplitude',
    'energySource',
    'fatigueSource',
    'inputs',
    'outputs',
    'operatingLoop',
    'coreTension',
    'environments',
    'oneMove',
    'futureCards',
    'keySignals',
    'footer',
    'roleFit',
  ]) assert.equal(visibility[key], true, key);

  assert.equal(visibility.wrongSeatRisk, false);
  assert.equal(visibility.futureBottleneck, false);
  assert.equal(projection.energySource[0], 'Clear direction');
  assert.equal(projection.fatigueSource[0], 'Repeated ambiguity');
  assert.equal(projection.bestEnvironment[0], 'Decision rights are clear');
  assert.equal(projection.roleFitSignals[0], 'Builder');
  assert.match(projection.centerInterpretation, /This assessment suggests/);
  assert.match(projection.tension.detail, /Treat that as a pattern to test/);
  assert.doesNotMatch(JSON.stringify(projection), /Insufficient Evidence/);
});

test('all five trajectories become bounded observation questions rather than predictions', () => {
  const projection = buildCustomerVisualDNAProjection(visualFixture());
  assert.deepEqual(projection.futureCards.map(({ title }) => title), [
    'Current Trajectory',
    'Optimized Trajectory',
    'Overload Trajectory',
    'Leadership Trajectory',
    'Constraint Trajectory',
  ]);
  for (const card of projection.futureCards) {
    assert.equal(card.likelihood, 'Question to observe');
    assert.match(card.summary, /^Watch whether /);
    assert.match(card.summary, /not a prediction/);
  }
});

test('preview and fullscreen consume one shared customer projection and one shared artifact layout', async () => {
  const source = visualFixture();
  const sourceBefore = structuredClone(source);
  const projection = buildCustomerVisualDNAProjection(source);
  const renderer = await readFile(
    new URL('../src/components/visualDNA/DeterministicBOSDNAVisualV2.jsx', import.meta.url),
    'utf8',
  );

  assert.deepEqual(source, sourceBefore);
  assert.equal(projection.primaryDimension.label, 'Command');
  assert.doesNotMatch(JSON.stringify(projection), /\bVector\b/);
  assert.equal(
    renderer.match(/const vm = buildCustomerVisualDNAProjection\(resolvedViewModel\);/g)?.length,
    1,
  );
  assert.doesNotMatch(renderer, /function PreviewPoster/);
  assert.doesNotMatch(renderer, /isPreview\s*\?/);
  assert.equal(renderer.match(/className="bos-dna-v2__grid"/g)?.length, 1);
  assert.match(renderer, /data-visual-dna-layout="shared-premium-artifact"/);
  assert.match(renderer, /<DimensionRow[\s\S]*item=\{item\}/);
  assert.match(renderer, /data-visual-dna-projection=\{customerPresentation\?\.version/);
  assert.match(renderer, /What May Energize You/);
  assert.match(renderer, /Environment to Test/);
  assert.match(renderer, /Patterns to Notice/);
});

test('premium hierarchy makes the operating core the anchor without changing supported content', async () => {
  const renderer = await readFile(
    new URL('../src/components/visualDNA/DeterministicBOSDNAVisualV2.jsx', import.meta.url),
    'utf8',
  );

  assert.match(renderer, /Your Operating Core/);
  assert.match(renderer, /className="bos-dna-v2__engine-story"/);
  assert.match(renderer, /width: min\(82%, 420px\)/);
  assert.match(renderer, /Your Measured Pattern/);
  assert.match(renderer, /Inputs That May Guide You/);
  assert.match(renderer, /Patterns You May Put Into Motion/);
  assert.match(renderer, /What May Drain You/);
  assert.match(renderer, /A Tension to Notice/);
  assert.match(renderer, /Trajectories to Observe/);
  assert.match(renderer, /Questions, not predictions/);
  assert.match(renderer, /Environment to Test/);
  assert.match(renderer, /Context to Watch/);
  assert.match(renderer, /One Move to Test/);
});

test('exact Layer 2 fallback remains source-identical while customer labels are translated at render time', () => {
  const source = visualFixture();
  delete source.customerPresentation;
  const before = structuredClone(source);
  const projection = buildCustomerVisualDNAProjection(source);

  assert.deepEqual(source, before);
  assert.equal(projection.customerPresentation, undefined);
  assert.equal(projection.primaryDimension.key, source.primaryDimension.key);
  assert.equal(projection.primaryDimension.value, source.primaryDimension.value);
  assert.equal(projection.primaryDimension.label, 'Command');
});
