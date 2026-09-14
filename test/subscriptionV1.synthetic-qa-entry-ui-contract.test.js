import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');

test('synthetic QA denial entry uses a one-time server proof and never persists or echoes the MM ID', () => {
  assert.match(ui, /fetch\('\/api\/internal\/subscription-v1-qa-entry'/u);
  assert.match(ui, /'x-subscription-qa-entry-csrf': requestProof/u);
  assert.match(ui, /JSON\.stringify\(\{ profile_id: profileId \}\)/u);
  assert.match(ui, /if \(input\) input\.value = ''/u);
  assert.match(ui, /profileId = ''/u);
  assert.match(ui, /body\.code !== 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_READY'/u);
  assert.match(ui, /body\.code === 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_ISSUED'/u);
  assert.match(ui, /body\.synthetic_only === true/u);
  assert.match(ui, /body\.billing_evidence === false/u);
  assert.match(ui, /globalThis\.location\.reload\(\)/u);
  assert.doesNotMatch(ui, /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^\n]*profile/iu);
  assert.doesNotMatch(ui, /console\.(?:log|warn|error)/u);
});

test('synthetic QA subscriber is durable and visibly nonbilling without demo or provider controls', () => {
  assert.match(ui, /syntheticQaConversation = bootstrap\.subscriber\?\.kind === 'SYNTHETIC_QA_SUBSCRIBER'/u);
  assert.match(ui, /const durableConversation = paidConversation \|\| syntheticQaConversation/u);
  assert.match(ui, /if \(syntheticQaConversation\) \{\s*demoSubject = null\s*ephemeralStorageEnabled = false/u);
  assert.match(ui, /syntheticQaSubscriber\s*\? <div className="s2-synthetic-qa-label"><strong>SYNTHETIC QA<\/strong><span>No paid subscription<\/span><\/div>\s*: <>/u);
  assert.match(ui, /data-synthetic-qa=\{syntheticQaSubscriber \? 'true' : undefined\}/u);
  assert.match(ui, /data-demo-subject=\{syntheticQaSubscriber \? undefined : DEMO_SUBJECT\}/u);
});

test('every authenticated shell can explicitly switch through the same protected MM-ID lane without resetting or exposing history', () => {
  const entryStart = ui.indexOf('function SyntheticQaEntryForm')
  const entryEnd = ui.indexOf('function AllowanceBoundary')
  const entrySource = ui.slice(entryStart, entryEnd)
  assert.match(ui, /if \(state\.loading\) \{\s*setQaEntry\(\{ checking: false, proof: null \}\)/u);
  assert.match(ui, /qaEntry\.proof && <SyntheticQaEntryForm initialProof=\{qaEntry\.proof\} compact activeSynthetic=\{syntheticQaSubscriber\}/u);
  assert.match(entrySource, /<summary>\{activeSynthetic \? 'Switch synthetic QA person' : 'Open synthetic QA person'\}<\/summary>/u);
  assert.match(entrySource, /Your current relationship remains unchanged\./u);
  assert.doesNotMatch(entrySource, /subscription-v1-demo-reset|sessionStorage|conversation|publication|view_model/u);
  assert.equal((entrySource.match(/JSON\.stringify\(\{ profile_id: profileId \}\)/gu) || []).length, 1);
});

test('paid and Darren demo source contracts remain explicitly separate from synthetic QA', () => {
  assert.match(ui, /const paidSubscriber = state\.bootstrap\?\.subscriber\?\.kind === 'PAID_SUBSCRIBER'/u);
  assert.match(ui, /paidSubscriber && <p className="subscription-capability-note"/u);
  assert.match(ui, /!paidSubscriber && <nav className="s2-demo-toolbar"/u);
  assert.match(ui, /<strong>SYNTHETIC JORDAN<\/strong><span>Demo-only relationship<\/span>/u);
  assert.match(ui, /MODEL \{selection\}/u);
  assert.match(ui, /RESET DEMO/u);
});
