import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import { buildDeterministicLayer3Translation } from '../src/lib/bosCustomerIntelligence/deterministicFallback.js';
import {
  hasMatchingLayer3Translation,
  resolveLayer3ReportViewModel,
} from '../src/lib/bosCustomerIntelligence/runtimeActivation.js';
import { buildLayer3SemanticPacket } from '../src/lib/bosCustomerIntelligence/semanticPacket.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';
import {
  SYNTHETIC_PROFILE_ID,
  buildCompleteBosUiAnswers,
} from './fixtures/bosMeasurementFoundationFixture.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

let componentModule;
let viteServer;
let fixturePromise;

async function buildLayer2Fixture() {
  const answers = normalizeAssessmentAnswers(buildCompleteBosUiAnswers());
  const profileInput = new BuildProfileInput().build({
    answers,
    metadata: { profile_id: SYNTHETIC_PROFILE_ID },
  });
  const canonicalProfile = await generateCanonicalProfile(profileInput, {
    profile_id: SYNTHETIC_PROFILE_ID,
    model: 'layer3-runtime-guard-test',
  });
  const canonical = {
    profile_id: SYNTHETIC_PROFILE_ID,
    person_name: 'Synthetic Operator',
    company_name: 'Synthetic Company',
    intake_answers: answers,
    canonical_profile_json: canonicalProfile,
  };
  const narrative = await buildNarrativeV3(canonical, false, null, true);
  const viewModel = buildCustomerBOSViewModel({
    canonical,
    narrative,
    profileId: canonical.profile_id,
    personName: canonical.person_name,
    company: canonical.company_name,
    ranked: canonicalProfile.ranked_dimensions,
  });
  return { viewModel };
}

before(async () => {
  viteServer = await createServer({
    root: repoRoot,
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED': JSON.stringify('false'),
    },
    server: { middlewareMode: true },
    appType: 'custom',
  });
  componentModule = await viteServer.ssrLoadModule(
    '/src/components/reports/Layer3CustomerIntelligenceReport.jsx',
  );
  fixturePromise = buildLayer2Fixture();
});

after(async () => {
  await viteServer?.close();
});

test('disabled client flag and null translation render Layer 2 without a black-screen crash', async () => {
  const { viewModel } = await fixturePromise;
  const html = renderToString(
    React.createElement(componentModule.default, { viewModel }),
  );

  assert.match(html, /final-bos-customer-report/);
  assert.match(html, /Synthetic Operator/);
});

test('incomplete, undefined, stale, and invalid translation states preserve exact Layer 2', async () => {
  const { viewModel } = await fixturePromise;
  const packet = buildLayer3SemanticPacket(viewModel);
  const validBundle = buildDeterministicLayer3Translation(packet);
  const prepared = { packet, viewModel };
  const cases = [
    { label: 'remoteTranslation null', remote: null, candidatePacket: packet },
    { label: 'prepared.packet null', remote: null, candidatePacket: null },
    {
      label: 'undefined hashes',
      remote: { sourceHash: undefined, bundle: validBundle, receipt: { source: 'cache' } },
      candidatePacket: { ...packet, semantic_hash: undefined },
    },
    {
      label: 'mismatched hash',
      remote: { sourceHash: 'fnv1a64:stale', bundle: validBundle, receipt: { source: 'cache' } },
      candidatePacket: packet,
    },
    {
      label: 'missing bundle',
      remote: { sourceHash: packet.semantic_hash, bundle: null, receipt: { source: 'cache' } },
      candidatePacket: packet,
    },
    {
      label: 'invalid bundle',
      remote: {
        sourceHash: packet.semantic_hash,
        bundle: { ...validBundle, translations: [] },
        receipt: { source: 'cache' },
      },
      candidatePacket: packet,
    },
  ];

  for (const { label, remote, candidatePacket } of cases) {
    assert.equal(
      hasMatchingLayer3Translation(remote, candidatePacket),
      false,
      label,
    );
    assert.strictEqual(
      resolveLayer3ReportViewModel(
        viewModel,
        { ...prepared, packet: candidatePacket },
        remote,
      ),
      viewModel,
      label,
    );
  }
});

test('matching source hash with a valid bundle activates Layer 3', async () => {
  const { viewModel } = await fixturePromise;
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  const remoteTranslation = {
    sourceHash: packet.semantic_hash,
    bundle,
    receipt: { source: 'cache' },
  };
  assert.equal(hasMatchingLayer3Translation(remoteTranslation, packet), true);
  const translated = resolveLayer3ReportViewModel(
    viewModel,
    { packet, viewModel },
    remoteTranslation,
  );
  assert.notStrictEqual(translated, viewModel);
  assert.equal(translated.customer_intelligence.source_hash, packet.semantic_hash);
});
