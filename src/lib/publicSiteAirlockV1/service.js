import crypto from 'node:crypto';
import {
  PUBLIC_ACCESS_CONTRACT_VERSION,
  PUBLIC_INQUIRY_CONTRACT_VERSION,
  boundedText,
  canonicalJson,
  normalizeEmail,
  normalizeProfileId,
  productForKey,
  sha256,
} from './contracts.js';
import { complimentaryDigest, sealStartToken, verifyStartToken } from './security.js';
import { buildCustomerConfirmedVerticalBinding } from '../../../api/business-assessment/verticalBinding.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY, buildCustomerConfirmedSelection } from '../baVerticalCassettesV1/index.js';

const READY = new Set(['ready', 'complete']);

function json(value) { return JSON.stringify(value); }
function parse(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, '')}`;
}

function nowIso(clock) { return new Date(clock()).toISOString(); }

function currentConfirmedVerticalSelection(input) {
  const verticalId = boundedText(input?.vertical_id, 80);
  const confirmed = String(input?.confirmation || '').toUpperCase() === 'CUSTOMER_CONFIRMED';
  if (!verticalId || !confirmed) throw new Error('BA_VERTICAL_SELECTION_UNCONFIRMED');
  return buildCustomerConfirmedSelection(PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical(verticalId));
}

function requireIdempotencyKey(value) {
  const key = boundedText(value, 160);
  if (key.length < 12) throw new Error('idempotency_key_required');
  return key;
}

function publicGrant(grant) {
  return {
    grant_id: grant.grant_id,
    product_key: grant.product_key,
    status: grant.status,
    source: grant.source,
    profile_id: grant.profile_id || null,
    vertical_id: grant.vertical_binding?.vertical_id || null,
    created_at: grant.created_at,
  };
}

function parseComplimentaryManifest(raw) {
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('complimentary_manifest_invalid'); }
  if (!Array.isArray(parsed)) throw new Error('complimentary_manifest_invalid');
  return parsed.map((item) => ({
    digest: boundedText(item?.digest, 64),
    product_key: boundedText(item?.product_key, 80),
    status: boundedText(item?.status || 'active', 20),
    expires_at: boundedText(item?.expires_at, 40),
    max_uses: Math.min(Math.max(Number(item?.max_uses) || 1, 1), 100),
    capability_id: boundedText(item?.capability_id, 120),
  })).filter((item) => /^[a-f0-9]{64}$/u.test(item.digest) && productForKey(item.product_key));
}

export function createPublicSiteService({
  store,
  clock = Date.now,
  startSigningKey,
  complimentaryPepper,
  complimentaryManifest = '[]',
  profileStateReader = async () => ({ bos: 'unknown', ba: 'unknown' }),
  ownershipVerifier = async () => false,
  inquiryTransport = null,
} = {}) {
  if (!store) throw new Error('public_store_required');

  async function withLock(key, work) {
    const token = randomId('lock');
    if (!await store.setNx(key, token, 30)) throw new Error('operation_in_progress');
    try { return await work(); } finally {
      if (await store.get(key) === token) await store.del(key);
    }
  }

  async function enforceRateLimit({ scope, identity, limit = 20, windowMs = 60_000 }) {
    const normalizedScope = boundedText(scope, 80) || 'public';
    const fingerprint = sha256(boundedText(identity, 320) || 'unknown');
    const window = Math.floor(clock() / windowMs);
    const key = `public_rate_v1:${normalizedScope}:${fingerprint}:${window}`;
    const count = await store.incr(key);
    if (count === 1 && store.expire) await store.expire(key, Math.ceil(windowMs / 1000) + 5);
    if (count > limit) throw new Error('rate_limited');
    return { allowed: true, remaining: Math.max(0, limit - count) };
  }

  async function createPurchaseIntent(input = {}) {
    const idem = requireIdempotencyKey(input.idempotency_key);
    const product = productForKey(input.product_key);
    const email = normalizeEmail(input.email);
    const profileId = normalizeProfileId(input.profile_id);
    if (!product) throw new Error('product_not_found');
    if (input.email && !email) throw new Error('valid_email_required');
    if (product.product_key !== 'behavior_operating_system' && !profileId) throw new Error('profile_id_required');
    if (product.product_key === 'more_monthly_intelligence') throw new Error('subscription_checkout_gated');

    let profileState = null;
    let verticalBinding = null;
    if (product.product_key === 'business_assessment') {
      profileState = await profileStateReader(profileId);
      if (!READY.has(profileState?.bos)) throw new Error('completed_bos_required');
      verticalBinding = buildCustomerConfirmedVerticalBinding({ selection: currentConfirmedVerticalSelection(input.vertical_selection), selectedAt: nowIso(clock) });
    }

    const key = `public_product_v1:purchase_intent_by_idempotency:${sha256(idem)}`;
    const existing = parse(await store.get(key));
    if (existing) return { ...existing, idempotent: true };

    return withLock(`${key}:lock`, async () => {
      const replay = parse(await store.get(key));
      if (replay) return { ...replay, idempotent: true };
      const intent = {
        intent_id: randomId('pi_more'),
        contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
        product_key: product.product_key,
        access_type: product.access_type,
        expected_price_minor: product.price_minor,
        currency: product.currency,
        cadence: product.cadence,
        email,
        profile_id: profileId,
        vertical_binding: verticalBinding,
        status: 'awaiting_provider_checkout',
        created_at: nowIso(clock),
      };
      await store.set(key, json(intent));
      await store.set(`public_product_v1:purchase_intent:${intent.intent_id}`, json(intent));
      return { ...intent, idempotent: false };
    });
  }

  async function recordPaymentGrant(input = {}) {
    const eventId = boundedText(input.event_id, 160);
    const sessionId = boundedText(input.checkout_session_id, 160);
    const intentId = boundedText(input.intent_id, 160);
    if (!eventId || !sessionId || !intentId) throw new Error('payment_binding_required');
    if (input.payment_truth !== 'provider_confirmed') throw new Error('provider_payment_confirmation_required');
    const eventKey = `payment_event_v2:${eventId}`;

    return withLock(`${eventKey}:lock`, async () => {
      const previous = parse(await store.get(eventKey));
      if (previous?.phase === 'complete') return { ...previous.result, idempotent: true };
      const intent = parse(await store.get(`public_product_v1:purchase_intent:${intentId}`));
      if (!intent) throw new Error('purchase_intent_not_found');
      await store.set(eventKey, json({ phase: 'processing', event_id: eventId, intent_id: intentId }));

      const grantId = `grant_${sessionId}`;
      const grantKey = `access_grant:${grantId}`;
      const existingGrant = parse(await store.get(grantKey));
      const grant = existingGrant || {
        grant_id: grantId,
        contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
        product_key: intent.product_key,
        access_type: intent.access_type,
        email: normalizeEmail(input.customer_email) || intent.email,
        profile_id: intent.profile_id,
        vertical_binding: intent.vertical_binding,
        source: 'paid_stripe',
        status: 'active',
        checkout_session_id: sessionId,
        stripe_event_id: eventId,
        purchase_intent_id: intentId,
        created_at: nowIso(clock),
        updated_at: nowIso(clock),
      };
      await store.set(grantKey, json(grant));
      if (grant.email) await store.sadd(`access_grant_by_email:${grant.email}`, grantId);
      if (grant.profile_id) await store.sadd(`access_grant_by_profile:${grant.profile_id}`, grantId);
      await store.sadd(`access_grant_by_session:${sessionId}`, grantId);
      await store.set(`public_product_v1:purchase_intent:${intentId}`, json({ ...intent, status: 'granted', grant_id: grantId, updated_at: nowIso(clock) }));
      const result = { grant: publicGrant(grant), payment_truth: 'provider_confirmed' };
      await store.set(eventKey, json({ phase: 'complete', event_id: eventId, intent_id: intentId, result }));
      return { ...result, idempotent: Boolean(existingGrant) };
    });
  }

  async function redeemComplimentary(input = {}) {
    const idem = requireIdempotencyKey(input.idempotency_key);
    const product = productForKey(input.product_key);
    if (!product || product.product_key === 'more_monthly_intelligence') throw new Error('complimentary_product_not_available');
    const code = boundedText(input.capability, 240);
    const digest = complimentaryDigest(code, complimentaryPepper);
    const manifest = parseComplimentaryManifest(complimentaryManifest);
    const capability = manifest.find((item) => item.digest === digest);
    if (!capability || capability.product_key !== product.product_key || capability.status !== 'active') {
      throw new Error('complimentary_capability_invalid');
    }
    if (!capability.expires_at || Date.parse(capability.expires_at) <= clock()) throw new Error('complimentary_capability_expired');

    const profileId = normalizeProfileId(input.profile_id);
    let verticalBinding = null;
    if (product.product_key === 'business_assessment') {
      if (!profileId) throw new Error('profile_id_required');
      const profileState = await profileStateReader(profileId);
      if (!READY.has(profileState?.bos)) throw new Error('completed_bos_required');
      verticalBinding = buildCustomerConfirmedVerticalBinding({ selection: currentConfirmedVerticalSelection(input.vertical_selection), selectedAt: nowIso(clock) });
    }
    const subjectKey = profileId || boundedText(input.email, 254).toLowerCase() || 'unbound';
    const redemptionId = sha256(`${digest}:${product.product_key}:${subjectKey}:${idem}`);
    const redemptionKey = `public_product_v1:complimentary_redemption:${redemptionId}`;
    const existing = parse(await store.get(redemptionKey));
    if (existing) return { ...existing, idempotent: true };

    return withLock(`public_product_v1:complimentary_lock:${digest}`, async () => {
      const replay = parse(await store.get(redemptionKey));
      if (replay) return { ...replay, idempotent: true };
      const usageKey = `public_product_v1:complimentary_uses:${digest}`;
      const uses = await store.smembers(usageKey);
      if (uses.length >= capability.max_uses) throw new Error('complimentary_capability_exhausted');
      const grantId = `grant_comp_${redemptionId.slice(0, 24)}`;
      const grant = {
        grant_id: grantId,
        contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
        product_key: product.product_key,
        access_type: product.access_type,
        profile_id: profileId,
        vertical_binding: verticalBinding,
        source: 'complimentary_capability',
        status: 'active',
        capability_id: capability.capability_id || null,
        created_at: nowIso(clock),
        updated_at: nowIso(clock),
      };
      await store.set(`access_grant:${grantId}`, json(grant));
      if (profileId) await store.sadd(`access_grant_by_profile:${profileId}`, grantId);
      await store.sadd(usageKey, redemptionId);
      const result = { grant: publicGrant(grant) };
      await store.set(redemptionKey, json(result));
      return { ...result, idempotent: false };
    });
  }

  async function lookupEntry(input = {}) {
    const raw = boundedText(input.value, 240);
    const profileId = normalizeProfileId(raw);
    if (!profileId) return { state: 'capability_or_locator_unrecognized' };
    const verified = await ownershipVerifier({ profile_id: profileId, proof: input.ownership_proof });
    if (!verified) return { state: 'ownership_verification_required' };
    const profileState = await profileStateReader(profileId);
    return {
      state: profileState?.bos || 'missing',
      profile_id: profileId,
      business_assessment_state: profileState?.ba || 'missing',
    };
  }

  async function createStartTokenForGrant(input = {}) {
    const grant = parse(await store.get(`access_grant:${boundedText(input.grant_id, 180)}`));
    if (!grant || grant.status !== 'active') throw new Error('active_grant_required');
    return {
      start_token: sealStartToken({ grant_id: grant.grant_id, product_key: grant.product_key }, startSigningKey, clock()),
      grant: publicGrant(grant),
    };
  }

  async function createStartTokenForSession(input = {}) {
    const sessionId = boundedText(input.checkout_session_id, 180);
    if (!sessionId) throw new Error('active_grant_required');
    const grantIds = await store.smembers(`access_grant_by_session:${sessionId}`);
    for (const grantId of grantIds) {
      const grant = parse(await store.get(`access_grant:${grantId}`));
      if (!grant || grant.status !== 'active') continue;
      return createStartTokenForGrant({ grant_id: grant.grant_id });
    }
    throw new Error('active_grant_required');
  }

  async function startProduct(input = {}) {
    const claims = verifyStartToken(input.start_token, startSigningKey, clock());
    const grant = parse(await store.get(`access_grant:${claims.grant_id}`));
    if (!grant || grant.status !== 'active' || grant.product_key !== claims.product_key) throw new Error('active_grant_required');
    const product = productForKey(grant.product_key);
    if (!product?.destination) throw new Error('product_destination_gated');
    const profileId = normalizeProfileId(input.profile_id || grant.profile_id);
    if (product.product_key === 'business_assessment') {
      if (!profileId || profileId !== grant.profile_id) throw new Error('grant_profile_binding_mismatch');
      if (!grant.vertical_binding?.binding_sha256) throw new Error('grant_vertical_binding_required');
    }
    const startKey = `public_product_v1:start:${grant.grant_id}`;
    const existing = parse(await store.get(startKey));
    if (existing) return { ...existing, idempotent: true };
    const start = {
      start_id: randomId('start_more'),
      grant_id: grant.grant_id,
      product_key: product.product_key,
      profile_id: profileId,
      vertical_binding: grant.vertical_binding || null,
      status: 'ready',
      destination: product.destination,
      created_at: nowIso(clock),
    };
    await store.setNx(startKey, json(start));
    const persisted = parse(await store.get(startKey));
    return { ...persisted, idempotent: persisted.start_id !== start.start_id };
  }

  async function createInquiry(input = {}) {
    const idem = requireIdempotencyKey(input.idempotency_key);
    if (boundedText(input.website, 200)) throw new Error('inquiry_rejected');
    const name = boundedText(input.name, 120);
    const phone = boundedText(input.phone, 40);
    const email = normalizeEmail(input.email);
    if (name.length < 2 || phone.replace(/\D/gu, '').length < 10 || !email) throw new Error('valid_inquiry_fields_required');
    const receiptId = `inq_${sha256(idem).slice(0, 28)}`;
    const receiptKey = `public_inquiry_v1:receipt:${receiptId}`;
    const existing = parse(await store.get(receiptKey));
    if (existing) return { receipt_id: receiptId, state: existing.state, idempotent: true };
    const now = nowIso(clock);
    const receipt = {
      contract_version: PUBLIC_INQUIRY_CONTRACT_VERSION,
      receipt_id: receiptId,
      state: 'accepted_for_delivery',
      name,
      phone,
      email,
      source: 'mmm_public_step_4',
      accepted_at: now,
    };
    const outbox = {
      outbox_id: `outbox_${receiptId}`,
      receipt_id: receiptId,
      state: 'pending',
      attempts: 0,
      next_attempt_at: now,
      created_at: now,
      destination_ref: 'server_configured_more_sales_inbox',
    };
    if (!await store.setNx(receiptKey, json(receipt))) {
      const replay = parse(await store.get(receiptKey));
      return { receipt_id: receiptId, state: replay.state, idempotent: true };
    }
    await store.set(`public_inquiry_v1:outbox:${outbox.outbox_id}`, json(outbox));
    await store.sadd('public_inquiry_v1:outbox:pending', outbox.outbox_id);
    return { receipt_id: receiptId, state: receipt.state, idempotent: false };
  }

  async function dispatchInquiry(outboxId) {
    if (!inquiryTransport?.send) throw new Error('inquiry_transport_unavailable');
    const key = `public_inquiry_v1:outbox:${boundedText(outboxId, 180)}`;
    return withLock(`${key}:lock`, async () => {
      const outbox = parse(await store.get(key));
      if (!outbox) throw new Error('inquiry_outbox_not_found');
      if (outbox.state === 'delivered') return { state: 'delivered', idempotent: true };
      const receipt = parse(await store.get(`public_inquiry_v1:receipt:${outbox.receipt_id}`));
      try {
        const delivery = await inquiryTransport.send({
          receipt_id: receipt.receipt_id,
          name: receipt.name,
          phone: receipt.phone,
          email: receipt.email,
          destination_ref: outbox.destination_ref,
        });
        const next = { ...outbox, state: 'delivered', attempts: outbox.attempts + 1, delivered_at: nowIso(clock), provider_receipt: boundedText(delivery?.id, 160) || null };
        await store.set(key, json(next));
        await store.set(`public_inquiry_v1:receipt:${receipt.receipt_id}`, json({ ...receipt, state: 'delivered' }));
        return { state: 'delivered', idempotent: false };
      } catch {
        const next = { ...outbox, state: 'retry_pending', attempts: outbox.attempts + 1, last_failure_at: nowIso(clock) };
        await store.set(key, json(next));
        return { state: 'retry_pending', idempotent: false };
      }
    });
  }

  return Object.freeze({
    createPurchaseIntent,
    recordPaymentGrant,
    redeemComplimentary,
    lookupEntry,
    createStartTokenForGrant,
    createStartTokenForSession,
    startProduct,
    createInquiry,
    dispatchInquiry,
    enforceRateLimit,
  });
}

export function paymentEventDigest(event) {
  return sha256(canonicalJson(event));
}
