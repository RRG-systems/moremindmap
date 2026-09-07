import crypto from 'node:crypto';
import {
  PUBLIC_ACCESS_CONTRACT_VERSION,
  PUBLIC_INQUIRY_CONTRACT_VERSION,
  PUBLIC_PRODUCT_CONTRACT_VERSION,
  boundedText,
  canonicalJson,
  normalizeEmail,
  normalizeProfileId,
  productForKey,
  sha256,
} from './contracts.js';
import {
  PUBLIC_START_SESSION_TTL_MS,
  PUBLIC_START_TOKEN_TTL_MS,
  complimentaryDigest,
  sealStartToken,
  verifyStartToken,
} from './security.js';
import {
  buildCustomerConfirmedVerticalBinding,
  validatePersistedVerticalBinding,
} from '../../../api/business-assessment/verticalBinding.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY, buildCustomerConfirmedSelection } from '../baVerticalCassettesV1/index.js';

const READY = new Set(['ready', 'complete']);
const PURCHASE_INTENT_STATES = new Set(['awaiting_provider_checkout', 'granted']);
const START_TOKEN_EXCHANGE_RETRY_MS = 2 * 60 * 1000;
const PURCHASE_INTENT_REQUEST_CONTRACT_VERSION = 'mmm-public-purchase-intent-request-v1';
const COMPLIMENTARY_REDEMPTION_CONTRACT_VERSION = 'mmm-public-complimentary-redemption-v1';

function json(value) { return JSON.stringify(value); }
function parse(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, '')}`;
}

function nowIso(clock) { return new Date(clock()).toISOString(); }

function isFiniteTimestamp(value) {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function purchaseIntentRequestDigest({ productKey, email, profileId, verticalSelection }) {
  return sha256(canonicalJson({
    contract_version: PURCHASE_INTENT_REQUEST_CONTRACT_VERSION,
    product_key: productKey,
    email,
    profile_id: profileId,
    vertical_selection: verticalSelection,
  }));
}

function purchaseIntentSelectionFromBinding(binding) {
  if (!binding) return null;
  return {
    contract_version: binding.selection_contract_version,
    vertical_id: binding.vertical_id,
    cassette_id: binding.cassette_id,
    cassette_version: binding.cassette_version,
    confirmation: binding.selection_source,
  };
}

function immutablePurchaseIntent(intent) {
  return {
    intent_id: intent.intent_id,
    contract_version: intent.contract_version,
    product_key: intent.product_key,
    access_type: intent.access_type,
    expected_price_minor: intent.expected_price_minor,
    currency: intent.currency,
    cadence: intent.cadence,
    email: intent.email,
    profile_id: intent.profile_id,
    vertical_binding: intent.vertical_binding,
    request_sha256: intent.request_sha256,
    created_at: intent.created_at,
  };
}

function assertMatchingPurchaseIntentAuthority(candidate, canonical) {
  if (canonicalJson(immutablePurchaseIntent(candidate))
    !== canonicalJson(immutablePurchaseIntent(canonical))) {
    throw new Error('purchase_intent_contract_invalid');
  }
}

function complimentaryRequestDigest({
  capabilityDigest,
  productKey,
  subjectKey,
  idempotencyKey,
  email,
  profileId,
  verticalSelection,
}) {
  return sha256(canonicalJson({
    contract_version: COMPLIMENTARY_REDEMPTION_CONTRACT_VERSION,
    capability_digest: capabilityDigest,
    product_key: productKey,
    subject_key: subjectKey,
    idempotency_key: idempotencyKey,
    email,
    profile_id: profileId,
    vertical_selection: verticalSelection,
  }));
}

function assertComplimentaryGrantContract(grant, {
  grantId,
  redemptionId,
  requestSha256,
  product,
  capabilityId,
  email,
  profileId,
  verticalSelection,
}) {
  if (!grant || typeof grant !== 'object' || Array.isArray(grant)
    || !isFiniteTimestamp(grant.created_at)
    || !isFiniteTimestamp(grant.updated_at)) {
    throw new Error('complimentary_redemption_conflict');
  }
  let verticalBinding = null;
  if (product.product_key === 'business_assessment') {
    try { verticalBinding = validatePersistedVerticalBinding(grant.vertical_binding); }
    catch { throw new Error('complimentary_redemption_conflict'); }
    if (canonicalJson(purchaseIntentSelectionFromBinding(verticalBinding)) !== canonicalJson(verticalSelection)) {
      throw new Error('complimentary_redemption_conflict');
    }
  } else if (grant.vertical_binding !== null) {
    throw new Error('complimentary_redemption_conflict');
  }
  const expected = {
    grant_id: grantId,
    contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
    product_key: product.product_key,
    access_type: product.access_type,
    email,
    profile_id: profileId,
    vertical_binding: verticalBinding,
    source: 'complimentary_capability',
    status: 'active',
    capability_id: capabilityId,
    redemption_id: redemptionId,
    request_sha256: requestSha256,
    created_at: grant.created_at,
    updated_at: grant.updated_at,
  };
  if (canonicalJson(grant) !== canonicalJson(expected)) {
    throw new Error('complimentary_redemption_conflict');
  }
  return grant;
}

function expectedComplimentaryJournal({ redemptionId, requestSha256, grant }) {
  return {
    contract_version: COMPLIMENTARY_REDEMPTION_CONTRACT_VERSION,
    redemption_id: redemptionId,
    request_sha256: requestSha256,
    grant_id: grant.grant_id,
    state: 'complete',
    result: { grant: publicGrant(grant) },
  };
}

export function assertPersistedPurchaseIntentContract(intent, {
  intentId,
  sessionId = '',
} = {}) {
  const expectedIntentId = boundedText(intentId, 160);
  const expectedSessionId = boundedText(sessionId, 160);
  const product = productForKey(intent?.product_key);
  const rawEmail = boundedText(intent?.email, 254);
  const rawProfileId = boundedText(intent?.profile_id, 120);
  const exact = Boolean(intent)
    && typeof intent === 'object'
    && !Array.isArray(intent)
    && Boolean(expectedIntentId)
    && intent.intent_id === expectedIntentId
    && intent.contract_version === PUBLIC_PRODUCT_CONTRACT_VERSION
    && Boolean(product)
    && intent.product_key === product.product_key
    && product.product_key !== 'more_monthly_intelligence'
    && intent.access_type === product.access_type
    && Number.isSafeInteger(intent.expected_price_minor)
    && intent.expected_price_minor === product.price_minor
    && intent.currency === product.currency
    && intent.cadence === product.cadence
    && typeof intent.email === 'string'
    && rawEmail === intent.email
    && (!rawEmail || normalizeEmail(rawEmail) === rawEmail)
    && typeof intent.profile_id === 'string'
    && rawProfileId === intent.profile_id
    && (!rawProfileId || normalizeProfileId(rawProfileId) === rawProfileId)
    && PURCHASE_INTENT_STATES.has(intent.status)
    && isFiniteTimestamp(intent.created_at);
  if (!exact) throw new Error('purchase_intent_contract_invalid');

  if (product.product_key === 'business_assessment') {
    if (!rawProfileId) throw new Error('purchase_intent_contract_invalid');
    try {
      validatePersistedVerticalBinding(intent.vertical_binding);
    } catch {
      throw new Error('purchase_intent_contract_invalid');
    }
  } else if (intent.vertical_binding !== null) {
    throw new Error('purchase_intent_contract_invalid');
  }

  const expectedRequestSha256 = purchaseIntentRequestDigest({
    productKey: intent.product_key,
    email: intent.email,
    profileId: intent.profile_id,
    verticalSelection: purchaseIntentSelectionFromBinding(intent.vertical_binding),
  });
  if (intent.request_sha256 !== expectedRequestSha256) {
    throw new Error('purchase_intent_contract_invalid');
  }

  if (intent.status === 'granted') {
    const persistedSessionId = boundedText(intent.checkout_session_id, 160);
    const expectedGrantId = persistedSessionId ? `grant_${persistedSessionId}` : '';
    if (!persistedSessionId
      || (expectedSessionId && persistedSessionId !== expectedSessionId)
      || intent.grant_id !== expectedGrantId
      || !isFiniteTimestamp(intent.updated_at)) {
      throw new Error('purchase_intent_contract_invalid');
    }
  } else if (intent.grant_id !== undefined
    || intent.checkout_session_id !== undefined
    || intent.updated_at !== undefined) {
    throw new Error('purchase_intent_contract_invalid');
  }

  return { intent, product };
}

function assertPaymentJournalIdentity(journal, { eventId, intentId, sessionId, productKey }) {
  if (!journal) return;
  const grantId = `grant_${sessionId}`;
  const exact = (journal.phase === 'processing' || journal.phase === 'complete')
    && journal.event_id === eventId
    && journal.intent_id === intentId
    && journal.checkout_session_id === sessionId;
  if (!exact) throw new Error('payment_event_journal_collision');
  if (journal.phase === 'complete') {
    const projectedGrant = journal.result?.grant;
    if (!projectedGrant
      || projectedGrant.grant_id !== grantId
      || projectedGrant.product_key !== productKey
      || projectedGrant.status !== 'active'
      || journal.result?.payment_truth !== 'provider_confirmed') {
      throw new Error('payment_event_journal_collision');
    }
  }
}

function buildAuthoritativePaymentGrant({
  intent,
  eventId,
  sessionId,
  customerEmail,
  existingGrant,
  clock,
}) {
  const grantId = `grant_${sessionId}`;
  const providerEmail = normalizeEmail(customerEmail);
  const expectedEmail = providerEmail || intent.email;
  const intentProfileId = normalizeProfileId(intent.profile_id);
  let profileId = intentProfileId;

  if (existingGrant) {
    const existingEmailRaw = boundedText(existingGrant.email, 254);
    const existingEmail = normalizeEmail(existingEmailRaw);
    const existingProfileRaw = boundedText(existingGrant.profile_id, 120);
    const existingProfileId = normalizeProfileId(existingProfileRaw);
    const canPreserveBoundBosProfile = intent.product_key === 'behavior_operating_system'
      && !intentProfileId
      && Boolean(existingProfileId)
      && existingProfileRaw === existingProfileId;
    const profileMatches = existingGrant.profile_id === intentProfileId || canPreserveBoundBosProfile;
    const verticalMatches = existingGrant.vertical_binding === undefined
      || existingGrant.vertical_binding === null
      || canonicalJson(existingGrant.vertical_binding) === canonicalJson(intent.vertical_binding);
    const exact = existingGrant.grant_id === grantId
      && existingGrant.checkout_session_id === sessionId
      && existingGrant.product_key === intent.product_key
      && existingGrant.access_type === intent.access_type
      && profileMatches
      && existingGrant.email === existingEmailRaw
      && (!existingEmailRaw || existingEmail === existingEmailRaw)
      && (!expectedEmail || !existingEmail || existingEmail === expectedEmail)
      && verticalMatches
      && (!existingGrant.contract_version
        || existingGrant.contract_version === PUBLIC_ACCESS_CONTRACT_VERSION)
      && (!existingGrant.purchase_intent_id || existingGrant.purchase_intent_id === intent.intent_id)
      && (!existingGrant.stripe_event_id || existingGrant.stripe_event_id === eventId)
      && existingGrant.source === 'paid_stripe'
      && existingGrant.status === 'active'
      && (!existingGrant.created_at || isFiniteTimestamp(existingGrant.created_at));
    if (!exact) throw new Error('payment_grant_collision');
    if (canPreserveBoundBosProfile) profileId = existingProfileId;
  }

  const timestamp = nowIso(clock);
  return {
    grant_id: grantId,
    contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
    product_key: intent.product_key,
    access_type: intent.access_type,
    email: expectedEmail || normalizeEmail(existingGrant?.email),
    profile_id: profileId,
    vertical_binding: intent.vertical_binding,
    source: 'paid_stripe',
    status: 'active',
    checkout_session_id: sessionId,
    stripe_event_id: eventId,
    purchase_intent_id: intent.intent_id,
    created_at: existingGrant?.created_at || timestamp,
    updated_at: timestamp,
  };
}

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
    if (typeof store.compareDel !== 'function') throw new Error('atomic_lock_release_required');
    const token = randomId('lock');
    if (!await store.setNx(key, token, 30)) throw new Error('operation_in_progress');
    try { return await work(); } finally { await store.compareDel(key, token); }
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

  async function createPurchaseIntent(input = {}, requestContext = {}) {
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
    let verticalSelection = null;
    if (product.product_key === 'business_assessment') {
      const verified = await ownershipVerifier({
        profile_id: profileId,
        cookie_header: requestContext.cookie_header,
      });
      if (!verified) throw new Error('profile_ownership_required');
      profileState = await profileStateReader(profileId);
      if (!READY.has(profileState?.bos)) throw new Error('completed_bos_required');
      verticalSelection = currentConfirmedVerticalSelection(input.vertical_selection);
      verticalBinding = buildCustomerConfirmedVerticalBinding({ selection: verticalSelection, selectedAt: nowIso(clock) });
    }

    const requestSha256 = purchaseIntentRequestDigest({
      productKey: product.product_key,
      email,
      profileId,
      verticalSelection,
    });

    const key = `public_product_v1:purchase_intent_by_idempotency:${sha256(idem)}`;
    async function ensureCanonicalPurchaseIntent(candidate) {
      const intentKey = `public_product_v1:purchase_intent:${candidate.intent_id}`;
      const serialized = json(candidate);
      if (await store.setNx(intentKey, serialized)) return candidate;
      const canonicalRaw = await store.get(intentKey);
      const canonical = parse(canonicalRaw);
      if (!canonicalRaw || !canonical) throw new Error('purchase_intent_contract_invalid');
      assertPersistedPurchaseIntentContract(canonical, { intentId: candidate.intent_id });
      assertMatchingPurchaseIntentAuthority(candidate, canonical);
      return canonical;
    }
    async function exactReplay(raw) {
      if (!raw) return null;
      const candidate = parse(raw);
      if (!candidate) throw new Error('purchase_intent_contract_invalid');
      const candidateIntentId = boundedText(candidate.intent_id, 160);
      assertPersistedPurchaseIntentContract(candidate, { intentId: candidateIntentId });
      if (candidate.request_sha256 !== requestSha256) throw new Error('idempotency_parameter_mismatch');
      const canonical = await ensureCanonicalPurchaseIntent(candidate);
      return { ...canonical, idempotent: true };
    }
    const existing = await exactReplay(await store.get(key));
    if (existing) return existing;

    return withLock(`${key}:lock`, async () => {
      const replay = await exactReplay(await store.get(key));
      if (replay) return replay;
      const intent = {
        intent_id: randomId('pi_more'),
        contract_version: PUBLIC_PRODUCT_CONTRACT_VERSION,
        product_key: product.product_key,
        access_type: product.access_type,
        expected_price_minor: product.price_minor,
        currency: product.currency,
        cadence: product.cadence,
        email,
        profile_id: profileId,
        vertical_binding: verticalBinding,
        request_sha256: requestSha256,
        status: 'awaiting_provider_checkout',
        created_at: nowIso(clock),
      };
      if (!await store.setNx(key, json(intent))) {
        const winner = await exactReplay(await store.get(key));
        if (!winner) throw new Error('purchase_intent_contract_invalid');
        return winner;
      }
      await ensureCanonicalPurchaseIntent(intent);
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
    const intentKey = `public_product_v1:purchase_intent:${intentId}`;
    const grantId = `grant_${sessionId}`;
    const grantKey = `access_grant:${grantId}`;

    const initialIntentRaw = await store.get(intentKey);
    const initialIntent = parse(initialIntentRaw);
    if (!initialIntentRaw) throw new Error('purchase_intent_not_found');
    if (!initialIntent) throw new Error('purchase_intent_contract_invalid');
    const { product: initialProduct } = assertPersistedPurchaseIntentContract(initialIntent, {
      intentId,
      sessionId,
    });
    const initialJournalRaw = await store.get(eventKey);
    const initialJournal = parse(initialJournalRaw);
    if (initialJournalRaw && !initialJournal) throw new Error('payment_event_journal_collision');
    assertPaymentJournalIdentity(initialJournal, {
      eventId,
      intentId,
      sessionId,
      productKey: initialProduct.product_key,
    });
    if (initialJournal?.phase === 'complete') {
      return { ...initialJournal.result, idempotent: true };
    }
    const initialGrantRaw = await store.get(grantKey);
    const initialGrant = parse(initialGrantRaw);
    if (initialGrantRaw && !initialGrant) throw new Error('payment_grant_collision');
    buildAuthoritativePaymentGrant({
      intent: initialIntent,
      eventId,
      sessionId,
      customerEmail: input.customer_email,
      existingGrant: initialGrant,
      clock,
    });

    return withLock(`${eventKey}:lock`, async () => {
      const previousRaw = await store.get(eventKey);
      const previous = parse(previousRaw);
      if (previousRaw && !previous) throw new Error('payment_event_journal_collision');
      const intentRaw = await store.get(intentKey);
      const intent = parse(intentRaw);
      if (!intentRaw) throw new Error('purchase_intent_not_found');
      if (!intent) throw new Error('purchase_intent_contract_invalid');
      const { product } = assertPersistedPurchaseIntentContract(intent, { intentId, sessionId });
      assertPaymentJournalIdentity(previous, {
        eventId,
        intentId,
        sessionId,
        productKey: product.product_key,
      });
      if (previous?.phase === 'complete') return { ...previous.result, idempotent: true };
      await store.set(eventKey, json({
        phase: 'processing',
        event_id: eventId,
        intent_id: intentId,
        checkout_session_id: sessionId,
      }));

      const existingGrantRaw = await store.get(grantKey);
      const existingGrant = parse(existingGrantRaw);
      if (existingGrantRaw && !existingGrant) throw new Error('payment_grant_collision');
      const grant = buildAuthoritativePaymentGrant({
        intent,
        eventId,
        sessionId,
        customerEmail: input.customer_email,
        existingGrant,
        clock,
      });
      await store.set(grantKey, json(grant));
      if (grant.email) await store.sadd(`access_grant_by_email:${grant.email}`, grantId);
      if (grant.profile_id) await store.sadd(`access_grant_by_profile:${grant.profile_id}`, grantId);
      await store.sadd(`access_grant_by_session:${sessionId}`, grantId);
      await store.set(intentKey, json({
        ...intent,
        status: 'granted',
        grant_id: grantId,
        checkout_session_id: sessionId,
        updated_at: nowIso(clock),
      }));
      const result = { grant: publicGrant(grant), payment_truth: 'provider_confirmed' };
      await store.set(eventKey, json({
        phase: 'complete',
        event_id: eventId,
        intent_id: intentId,
        checkout_session_id: sessionId,
        result,
      }));
      return { ...result, idempotent: Boolean(existingGrant) };
    });
  }

  async function redeemComplimentary(input = {}, requestContext = {}) {
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

    const profileId = normalizeProfileId(input.profile_id);
    const rawEmail = boundedText(input.email, 254);
    const email = normalizeEmail(rawEmail);
    if (rawEmail && !email) throw new Error('valid_email_required');
    let verticalBinding = null;
    let verticalSelection = null;
    if (product.product_key === 'business_assessment') {
      if (!profileId) throw new Error('profile_id_required');
      const verified = await ownershipVerifier({
        profile_id: profileId,
        cookie_header: requestContext.cookie_header,
      });
      if (!verified) throw new Error('profile_ownership_required');
      const profileState = await profileStateReader(profileId);
      if (!READY.has(profileState?.bos)) throw new Error('completed_bos_required');
      verticalSelection = currentConfirmedVerticalSelection(input.vertical_selection);
      verticalBinding = buildCustomerConfirmedVerticalBinding({ selection: verticalSelection, selectedAt: nowIso(clock) });
    }
    const subjectKey = profileId || email || 'unbound';
    const redemptionId = sha256(`${digest}:${product.product_key}:${subjectKey}:${idem}`);
    const redemptionKey = `public_product_v1:complimentary_redemption:${redemptionId}`;
    const grantId = `grant_comp_${redemptionId.slice(0, 24)}`;
    const grantKey = `access_grant:${grantId}`;
    const usageKey = `public_product_v1:complimentary_uses:${digest}`;
    const profileIndexKey = profileId ? `access_grant_by_profile:${profileId}` : '';
    const requestSha256 = complimentaryRequestDigest({
      capabilityDigest: digest,
      productKey: product.product_key,
      subjectKey,
      idempotencyKey: idem,
      email,
      profileId,
      verticalSelection,
    });
    const capabilityId = capability.capability_id || null;

    async function exactReplay(raw) {
      if (!raw) return null;
      const journal = parse(raw);
      const grantRaw = await store.get(grantKey);
      const grant = parse(grantRaw);
      if (!journal || !grantRaw || !grant) throw new Error('complimentary_redemption_conflict');
      assertComplimentaryGrantContract(grant, {
        grantId,
        redemptionId,
        requestSha256,
        product,
        capabilityId,
        email,
        profileId,
        verticalSelection,
      });
      const expectedJournal = expectedComplimentaryJournal({ redemptionId, requestSha256, grant });
      if (canonicalJson(journal) !== canonicalJson(expectedJournal)) {
        throw new Error('complimentary_redemption_conflict');
      }
      const uses = await store.smembers(usageKey);
      if (!uses.includes(redemptionId)) throw new Error('complimentary_redemption_conflict');
      if (profileIndexKey) {
        const indexedGrantIds = await store.smembers(profileIndexKey);
        if (!indexedGrantIds.includes(grantId)) throw new Error('complimentary_redemption_conflict');
      }
      return { ...journal.result, idempotent: true };
    }

    const existing = await exactReplay(await store.get(redemptionKey));
    if (existing) return existing;

    return withLock(`public_product_v1:complimentary_lock:${digest}`, async () => {
      const replay = await exactReplay(await store.get(redemptionKey));
      if (replay) return { ...replay, idempotent: true };
      if (typeof store.commitComplimentaryRedemption !== 'function') {
        throw new Error('atomic_complimentary_commit_required');
      }
      const occupiedGrantRaw = await store.get(grantKey);
      const occupiedGrant = parse(occupiedGrantRaw);
      if (occupiedGrantRaw && !occupiedGrant) throw new Error('complimentary_redemption_conflict');
      if (occupiedGrant) {
        assertComplimentaryGrantContract(occupiedGrant, {
          grantId,
          redemptionId,
          requestSha256,
          product,
          capabilityId,
          email,
          profileId,
          verticalSelection,
        });
      }
      const capabilityExpiry = Date.parse(capability.expires_at || '');
      const recoverablePreExpiryGrant = occupiedGrant
        && Number.isFinite(capabilityExpiry)
        && Date.parse(occupiedGrant.created_at) <= capabilityExpiry;
      if (!Number.isFinite(capabilityExpiry)
        || (capabilityExpiry <= clock() && !recoverablePreExpiryGrant)) {
        throw new Error('complimentary_capability_expired');
      }
      const timestamp = nowIso(clock);
      const grant = occupiedGrant || {
        grant_id: grantId,
        contract_version: PUBLIC_ACCESS_CONTRACT_VERSION,
        product_key: product.product_key,
        access_type: product.access_type,
        email,
        profile_id: profileId,
        vertical_binding: verticalBinding,
        source: 'complimentary_capability',
        status: 'active',
        capability_id: capabilityId,
        redemption_id: redemptionId,
        request_sha256: requestSha256,
        created_at: timestamp,
        updated_at: timestamp,
      };
      const journal = expectedComplimentaryJournal({ redemptionId, requestSha256, grant });
      const outcome = await store.commitComplimentaryRedemption({
        redemptionKey,
        grantKey,
        usageKey,
        profileIndexKey,
        redemptionId,
        grantId,
        maxUses: capability.max_uses,
        serializedGrant: json(grant),
        serializedJournal: json(journal),
      });
      if (outcome === 'EXHAUSTED') throw new Error('complimentary_capability_exhausted');
      if (!['CREATED', 'REPAIRED', 'REPLAY'].includes(outcome)) {
        const winner = await exactReplay(await store.get(redemptionKey));
        if (winner) return winner;
        throw new Error('complimentary_redemption_conflict');
      }
      const persisted = await exactReplay(await store.get(redemptionKey));
      if (!persisted) throw new Error('complimentary_redemption_conflict');
      return { ...persisted, idempotent: outcome !== 'CREATED' };
    });
  }

  async function lookupEntry(input = {}, requestContext = {}) {
    const raw = boundedText(input.value, 240);
    const profileId = normalizeProfileId(raw);
    if (!profileId) return { state: 'capability_or_locator_unrecognized' };
    const verified = await ownershipVerifier({
      profile_id: profileId,
      cookie_header: requestContext.cookie_header,
    });
    if (!verified) return { state: 'ownership_verification_required' };
    const profileState = await profileStateReader(profileId);
    const product = productForKey(input.product_key || 'behavior_operating_system');
    if (!product || product.product_key === 'more_monthly_intelligence') {
      throw new Error('product_not_found');
    }
    return {
      state: product.product_key === 'business_assessment'
        ? (profileState?.ba || 'missing')
        : (profileState?.bos || 'missing'),
      profile_id: profileId,
      behavior_operating_system_state: profileState?.bos || 'missing',
      business_assessment_state: profileState?.ba || 'missing',
      ownership_verified: true,
      destination: product.destination,
    };
  }

  async function createStartTokenForGrant(input = {}) {
    const grant = parse(await store.get(`access_grant:${boundedText(input.grant_id, 180)}`));
    if (!grant || grant.status !== 'active') throw new Error('active_grant_required');
    const exchangeKey = `public_product_v1:start_token_exchange:${grant.grant_id}`;
    const now = Number(clock());
    const proposed = {
      contract_version: 'mmm-public-start-token-exchange-v1',
      grant_id: grant.grant_id,
      product_key: grant.product_key,
      issued_at_ms: now,
      retry_expires_at_ms: now + START_TOKEN_EXCHANGE_RETRY_MS,
      renewable_until_ms: now + PUBLIC_START_SESSION_TTL_MS,
    };
    const created = await store.setNx(exchangeKey, json(proposed));
    const exchange = created ? proposed : parse(await store.get(exchangeKey));
    if (!exchange
      || exchange.contract_version !== proposed.contract_version
      || exchange.grant_id !== grant.grant_id
      || exchange.product_key !== grant.product_key
      || !Number.isSafeInteger(exchange.issued_at_ms)
      || !Number.isSafeInteger(exchange.retry_expires_at_ms)
      || !Number.isSafeInteger(exchange.renewable_until_ms)
      || exchange.retry_expires_at_ms <= now
      || exchange.renewable_until_ms <= exchange.retry_expires_at_ms) {
      throw new Error('active_grant_required');
    }
    const claims = {
      grant_id: grant.grant_id,
      product_key: grant.product_key,
      renewable_until_ms: exchange.renewable_until_ms,
    };
    return {
      start_token: sealStartToken(claims, startSigningKey, exchange.issued_at_ms),
      grant: publicGrant(grant),
      expires_at_ms: exchange.issued_at_ms + PUBLIC_START_TOKEN_TTL_MS,
      renewable_until_ms: exchange.renewable_until_ms,
      idempotent: !created,
    };
  }

  async function createStartTokenForSession(input = {}) {
    const sessionId = boundedText(input.checkout_session_id, 180);
    if (!sessionId) throw new Error('active_grant_required');
    const grantIds = await store.smembers(`access_grant_by_session:${sessionId}`);
    const expectedGrantId = `grant_${sessionId}`;
    if (grantIds.length !== 1 || grantIds[0] !== expectedGrantId) throw new Error('active_grant_required');
    const grant = parse(await store.get(`access_grant:${expectedGrantId}`));
    if (!grant
      || grant.grant_id !== expectedGrantId
      || grant.checkout_session_id !== sessionId
      || grant.source !== 'paid_stripe'
      || grant.contract_version !== PUBLIC_ACCESS_CONTRACT_VERSION
      || grant.status !== 'active') {
      throw new Error('active_grant_required');
    }
    return createStartTokenForGrant({ grant_id: grant.grant_id });
  }

  async function renewStartToken(input = {}) {
    const now = Number(clock());
    let claims;
    try {
      claims = verifyStartToken(input.start_token, startSigningKey, now, { allowExpired: true });
    } catch {
      throw new Error('active_grant_required');
    }
    const renewableUntil = Number(claims.renewable_until_ms);
    if (!Number.isSafeInteger(renewableUntil) || renewableUntil - now < 60_000) {
      throw new Error('active_grant_required');
    }
    const grant = parse(await store.get(`access_grant:${boundedText(claims.grant_id, 180)}`));
    const start = parse(await store.get(`public_product_v1:start:${boundedText(claims.grant_id, 180)}`));
    if (!grant
      || grant.status !== 'active'
      || grant.product_key !== claims.product_key
      || !start
      || start.grant_id !== grant.grant_id
      || start.product_key !== grant.product_key
      || start.status !== 'ready') {
      throw new Error('active_grant_required');
    }
    const ttl = Math.min(PUBLIC_START_TOKEN_TTL_MS, renewableUntil - now);
    return {
      start_token: sealStartToken({
        grant_id: grant.grant_id,
        product_key: grant.product_key,
        renewable_until_ms: renewableUntil,
      }, startSigningKey, now, ttl),
      grant: publicGrant(grant),
      expires_at_ms: now + ttl,
      renewable_until_ms: renewableUntil,
    };
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
    if (!inquiryTransport?.send) throw new Error('inquiry_transport_unavailable');
    const idem = requireIdempotencyKey(input.idempotency_key);
    if (boundedText(input.website, 200)) throw new Error('inquiry_rejected');
    const name = boundedText(input.name, 120);
    const phone = boundedText(input.phone, 40);
    const email = normalizeEmail(input.email);
    if (name.length < 2 || phone.replace(/\D/gu, '').length < 10 || !email) throw new Error('valid_inquiry_fields_required');
    const receiptId = `inq_${sha256(idem).slice(0, 28)}`;
    const receiptKey = `public_inquiry_v1:receipt:${receiptId}`;
    const existing = parse(await store.get(receiptKey));
    if (existing) return { receipt_id: receiptId, outbox_id: `outbox_${receiptId}`, state: existing.state, idempotent: true };
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
      return { receipt_id: receiptId, outbox_id: `outbox_${receiptId}`, state: replay.state, idempotent: true };
    }
    await store.set(`public_inquiry_v1:outbox:${outbox.outbox_id}`, json(outbox));
    await store.sadd('public_inquiry_v1:outbox:pending', outbox.outbox_id);
    return { receipt_id: receiptId, outbox_id: outbox.outbox_id, state: receipt.state, idempotent: false };
  }

  async function dispatchInquiry(outboxId) {
    if (!inquiryTransport?.send) throw new Error('inquiry_transport_unavailable');
    const key = `public_inquiry_v1:outbox:${boundedText(outboxId, 180)}`;
    return withLock(`${key}:lock`, async () => {
      const outbox = parse(await store.get(key));
      if (!outbox) throw new Error('inquiry_outbox_not_found');
      if (outbox.state === 'delivered') return { state: 'delivered', idempotent: true };
      const nextAttemptAt = Date.parse(outbox.next_attempt_at || '');
      const checkedAt = Number(clock());
      if (outbox.state === 'retry_pending' && Number.isFinite(nextAttemptAt) && nextAttemptAt > checkedAt) {
        return {
          state: 'retry_pending',
          idempotent: true,
          retry_after_ms: nextAttemptAt - checkedAt,
        };
      }
      const receipt = parse(await store.get(`public_inquiry_v1:receipt:${outbox.receipt_id}`));
      try {
        const delivery = await inquiryTransport.send({
          outbox_id: outbox.outbox_id,
          receipt_id: receipt.receipt_id,
          name: receipt.name,
          phone: receipt.phone,
          email: receipt.email,
          destination_ref: outbox.destination_ref,
        });
        if (delivery?.success === false) throw new Error('inquiry_delivery_failed');
        const next = { ...outbox, state: 'delivered', attempts: outbox.attempts + 1, delivered_at: nowIso(clock), provider_receipt: boundedText(delivery?.id, 160) || null };
        await store.set(key, json(next));
        await store.set(`public_inquiry_v1:receipt:${receipt.receipt_id}`, json({ ...receipt, state: 'delivered' }));
        if (store.srem) await store.srem('public_inquiry_v1:outbox:pending', outbox.outbox_id);
        return { state: 'delivered', idempotent: false };
      } catch {
        const attempts = outbox.attempts + 1;
        const next = {
          ...outbox,
          state: 'retry_pending',
          attempts,
          last_failure_at: nowIso(clock),
          next_attempt_at: new Date(clock() + Math.min(60_000 * (2 ** Math.min(attempts, 6)), 60 * 60 * 1000)).toISOString(),
        };
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
    renewStartToken,
    startProduct,
    createInquiry,
    dispatchInquiry,
    enforceRateLimit,
  });
}

export function paymentEventDigest(event) {
  return sha256(canonicalJson(event));
}
