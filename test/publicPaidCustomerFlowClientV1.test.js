import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  clearPendingCheckoutSessionId,
  PUBLIC_CHECKOUT_SESSION_STORAGE_KEY,
  PUBLIC_START_TOKEN_STORAGE_KEY,
  readPendingCheckoutSessionId,
  storePendingCheckoutSessionId,
  storePublicStartToken,
} from '../src/lib/publicProductStartSession.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('payment return scrubs checkout session capability and retries bounded webhook confirmation', () => {
  const paymentSuccess = source('src/PaymentSuccess.jsx');
  assert.match(paymentSuccess, /checkoutSessionId \|\| readPendingCheckoutSessionId\(\)/u);
  assert.match(paymentSuccess, /storePendingCheckoutSessionId\(sessionId\)/u);
  assert.match(paymentSuccess, /scrubbed\.searchParams\.delete\('session_id'\)/u);
  assert.match(paymentSuccess, /attempt < MAX_ACCESS_CHECK_ATTEMPTS/u);
  assert.match(paymentSuccess, /ACCESS_CHECK_RETRY_DELAY_MS/u);
  assert.match(paymentSuccess, /payment_truth === 'webhook_confirmed'/u);
  assert.match(paymentSuccess, /const startTokenStored = storePublicStartToken\(startToken\);\s*if \(startTokenStored\) clearPendingCheckoutSessionId\(\)/u);
  assert.match(paymentSuccess, /Retry Verification/u);
  assert.doesNotMatch(paymentSuccess, /\{sessionId\}/u);
});

test('payment return session helpers keep pending checkout custody separate from the start token', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };

  assert.equal(storePendingCheckoutSessionId('checkout-session-capability', storage), true);
  assert.equal(readPendingCheckoutSessionId(storage), 'checkout-session-capability');
  assert.equal(values.get(PUBLIC_CHECKOUT_SESSION_STORAGE_KEY), 'checkout-session-capability');
  assert.equal(storePublicStartToken('start-token-capability', storage), true);
  assert.equal(values.get(PUBLIC_START_TOKEN_STORAGE_KEY), 'start-token-capability');
  assert.equal(clearPendingCheckoutSessionId(storage), true);
  assert.equal(readPendingCheckoutSessionId(storage), '');
  assert.equal(values.get(PUBLIC_START_TOKEN_STORAGE_KEY), 'start-token-capability');
});

test('public purchase and complimentary retries reuse a stable idempotency key for the same attempt', () => {
  const publicSite = source('src/PublicSiteV21.jsx');
  assert.match(publicSite, /const checkoutKey = useMemo\(\(\) => idempotencyKey\('bos-checkout'\), \[\]\)/u);
  assert.match(publicSite, /stableAttemptKey\(complimentaryAttempt, 'bos-comp', capability\)/u);
  assert.match(publicSite, /stableAttemptKey\(checkoutAttempt, 'ba-checkout', checkoutFingerprint\)/u);
  assert.doesNotMatch(publicSite, /purchase-intent'[\s\S]{0,180}idempotencyKey\('(?:bos|ba)-checkout'\)/u);
});

test('paid Subscription copy names the pinned Real Estate library without promising live web research', () => {
  const publicSite = source('src/PublicSiteV21.jsx');
  assert.match(publicSite, /draws from MORE’s Real Estate library when useful/u);
  assert.match(publicSite, /Uses MORE’s Real Estate library when useful/u);
  assert.doesNotMatch(publicSite, /researches when needed|Researches when you need current answers/u);
});

test('public BOS authority selects the deployed async start and status flow', () => {
  const profile = source('src/Profile.jsx');
  assert.match(profile, /payload\?\.product_key === 'behavior_operating_system'/u);
  assert.match(profile, /const useV2 = recruitingAuthorized\s*\|\| publicBosAuthorized/u);
  assert.match(profile, /`\/api\/moremindmap\/start`/u);
  assert.match(profile, /`\/api\/moremindmap\/status\?job_id=\$\{jobId\}`/u);
  assert.match(profile, /publicStartHeaders/u);
});

test('public BA authority resolves server-bound Profile and vertical before entering intake', () => {
  const businessAssessment = source('src/BusinessAssessment.jsx');
  assert.match(businessAssessment, /\/api\/public-v1\/product-start/u);
  assert.match(businessAssessment, /payload\?\.product_key !== 'business_assessment'/u);
  assert.match(businessAssessment, /payload\?\.vertical_binding\?\.binding_sha256/u);
  assert.match(businessAssessment, /PRODUCTION_BA_CASSETTE_REGISTRY\.resolveVertical/u);
  assert.match(businessAssessment, /setAssessmentProfile\(\{[\s\S]*?verticalSelection,[\s\S]*?\}\);/u);
  assert.match(businessAssessment, /setFlowStarted\(true\)/u);
});
