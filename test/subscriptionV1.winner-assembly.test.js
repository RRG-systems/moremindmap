import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FREE_GPT_V2_RUNTIME_POLICY,
  SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS,
} from '../src/lib/subscriptionV1/freeGptV2/index.js';
import { purposeRankPrivateAdvisorContext } from '../src/lib/subscriptionV1/freeGptV2/purposeRankedContext.js';

const source = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('winner assembly freezes GPT-5.6 Sol xhigh Free Frontier with exactly three demonstrations', () => {
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.model, 'gpt-5.6-sol');
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.api, 'RESPONSES');
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.reasoning_effort, 'xhigh');
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.store, false);
  assert.equal(FREE_GPT_V2_RUNTIME_POLICY.background, false);
  assert.equal(SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS.length, 3);
});

test('winner context selects no semantic cassette while preserving the corpus outside the selected turn', () => {
  const ranked = purposeRankPrivateAdvisorContext({
    purpose: 'WEEKLY_COACHING',
    active_lens: 'OVERVIEW',
    full_provider_understanding: {},
    doctrine_retrieval: {
      doctrine_id: 'test-doctrine',
      doctrine_version: '1',
      doctrine_hash: 'test-hash',
      layers: { universal_kernel: [], vertical_cassette: [] },
    },
  });
  assert.equal(ranked.doctrine_retrieval.semantic_cassette_injected, false);
  assert.equal(ranked.receipt.semantic_cassette_selected_count, 0);
  assert.equal(ranked.doctrine_retrieval.vertical_id, null);
});

test('final runtime excludes rejected S2.2 expression compression and keeps the S2 sandwich events', () => {
  const runtime = source('api/internal/subscription-v1-runtime.js');
  assert.doesNotMatch(runtime, /minimumSufficientTruthRuntime|createSubscriptionS22|customerExpressionRuntime/u);
  assert.match(runtime, /FIRST_SESSION_WELCOME/u);
  assert.match(runtime, /SESSION_OPENING/u);
  assert.match(runtime, /SESSION_CLOSING/u);
  assert.match(runtime, /SESSION_LEARNING/u);
  assert.match(runtime, /FREE_FRONTIER_DIRECT_NO_S2_2/u);
});

test('deterministic browser replay is opt-in and cannot silently replace the provider path', () => {
  const localServer = source('scripts/subscriptionS2LocalServer.mjs');
  assert.match(localServer, /SUBSCRIPTION_S2_LOCAL_QA_REPLAY/u);
  assert.match(localServer, /=== 'true'/u);
  assert.match(localServer, /LOCAL_QA_REPLAY \? \{ transport: localQaTransport \} : \{\}/u);
  assert.match(localServer, /loadProductionIntendedSyntheticSubscriber/u);
});
