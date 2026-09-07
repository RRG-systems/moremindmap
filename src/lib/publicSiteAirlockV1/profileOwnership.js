/* global Buffer, process */
import crypto from 'node:crypto';
import { boundedText, canonicalJson, normalizeProfileId, sha256 } from './contracts.js';
import { resolvePublicSiteOrigin } from './publicSiteOrigin.js';

export const PROFILE_OWNER_COOKIE = '__Host-more_profile_owner';
export const PROFILE_OWNER_CHALLENGE_TTL_SECONDS = 10 * 60;
export const PROFILE_OWNER_RECEIPT_TTL_SECONDS = 30 * 60;

const PURPOSE = 'PROFILE_BOUND_CUSTOMER_ENTRY';
const RECEIPT_VERSION = 'more-public-profile-owner-receipt-v1';
const CHALLENGE_VERSION = 'more-public-profile-owner-challenge-v1';
const ISSUER = 'MORE_MINDMAP_PUBLIC_PROFILE_OWNER';
const STATE_LOCK_TTL_SECONDS = 30;
const DEFAULT_MINIMUM_RESPONSE_DELAY_MS = 500;
const ALLOWED_RETURN_PATHS = new Set(['/step-1', '/step-2']);

function parse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function requireSigningKey(value) {
  const key = String(value || '');
  if (key.length < 32) throw new Error('profile_ownership_configuration_unavailable');
  return key;
}

function requireAudience(value) {
  const audience = boundedText(value, 500);
  if (!audience) throw new Error('profile_ownership_audience_unavailable');
  return audience;
}

export function resolveProfileOwnershipAudience(env = process.env) {
  const environment = boundedText(
    env.PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT || env.VERCEL_ENV,
    40,
  ).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/u.test(environment)) {
    throw new Error('profile_ownership_environment_unavailable');
  }
  return `${RECEIPT_VERSION}|${environment}|${resolvePublicSiteOrigin(env)}`;
}

function tokenDigest(token, signingKey, audience) {
  return crypto.createHmac('sha256', signingKey)
    .update(`mmm-public-profile-owner-challenge-v1\0${audience}\0${String(token || '')}`)
    .digest('hex');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sealReceipt(claims, signingKey, audience) {
  const body = base64url(canonicalJson(claims));
  const signature = crypto.createHmac('sha256', signingKey)
    .update(`mmm-public-profile-owner-receipt-v1\0${audience}\0${body}`)
    .digest('base64url');
  return `${body}.${signature}`;
}

function readCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return [part, ''];
    try { return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }
    catch { return [part.slice(0, index), '']; }
  }));
}

function verifyReceipt(token, signingKey, nowMs, audience) {
  const [body, supplied, extra] = String(token || '').split('.');
  if (!body || !supplied || extra) return null;
  const expected = crypto.createHmac('sha256', signingKey)
    .update(`mmm-public-profile-owner-receipt-v1\0${audience}\0${body}`)
    .digest('base64url');
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return null; }
  if (claims.version !== RECEIPT_VERSION
    || claims.purpose !== PURPOSE
    || claims.issuer !== ISSUER
    || claims.audience !== audience) return null;
  if (Number(claims.expires_at_ms) <= nowMs) return null;
  if (!normalizeProfileId(claims.profile_id)) return null;
  return claims;
}

function returnPath(value) {
  const path = boundedText(value, 40);
  return ALLOWED_RETURN_PATHS.has(path) ? path : '/step-1';
}

export function profileOwnerCookie(value, maxAgeSeconds = PROFILE_OWNER_RECEIPT_TTL_SECONDS) {
  return `${PROFILE_OWNER_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearProfileOwnerCookie() {
  return `${PROFILE_OWNER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function createProfileOwnershipAdapter({
  store,
  ownerReader,
  transport,
  signingKey,
  audience,
  clock = Date.now,
  tokenFactory = () => crypto.randomBytes(32).toString('base64url'),
  minimumResponseDelayMs = DEFAULT_MINIMUM_RESPONSE_DELAY_MS,
  monotonicClock = Date.now,
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  if (!store?.get || !store?.set || !store?.setNx || !store?.del || !store?.expire) {
    throw new Error('profile_owner_store_required');
  }
  if (typeof ownerReader !== 'function') throw new Error('profile_owner_reader_required');
  const boundAudience = requireAudience(audience);
  const audienceSha256 = sha256(boundAudience);
  const keyPrefix = `public_profile_owner_v1:${audienceSha256.slice(0, 32)}`;
  const uniformResult = Object.freeze({ state: 'verification_requested_if_available' });
  const minimumDelay = Math.min(Math.max(Number(minimumResponseDelayMs) || 0, 0), 5_000);

  async function releaseLock(key, token) {
    if (typeof store.compareDel === 'function') {
      await store.compareDel(key, token);
      return;
    }
    if (await store.get(key) === token) await store.del(key);
  }

  async function persistChallenge(key, challenge) {
    const remainingSeconds = Math.max(
      1,
      Math.ceil((Number(challenge.expires_at_ms) - Number(clock())) / 1000) + 60,
    );
    const serialized = JSON.stringify(challenge);
    if (typeof store.setExpiring === 'function') {
      await store.setExpiring(key, serialized, remainingSeconds);
      return;
    }
    await store.set(key, serialized);
    await store.expire(key, remainingSeconds);
  }

  function validChallenge(challenge, now) {
    const normalized = normalizeProfileId(challenge?.profile_id);
    return Boolean(challenge
      && challenge.version === CHALLENGE_VERSION
      && challenge.issuer === ISSUER
      && challenge.audience_sha256 === audienceSha256
      && normalized
      && normalized === challenge.profile_id
      && challenge.status === 'pending'
      && Number(challenge.expires_at_ms) > now);
  }

  async function applyMinimumResponseDelay(startedAt) {
    const elapsed = Math.max(0, Number(monotonicClock()) - startedAt);
    const remaining = minimumDelay - elapsed;
    if (remaining <= 0) return;
    try { await delay(remaining); } catch { /* response uniformity must not depend on the delay mechanism */ }
  }

  async function requestChallenge(input = {}) {
    const startedAt = Number(monotonicClock());
    try {
      const profileId = normalizeProfileId(input.profile_id);
      if (!profileId) throw new Error('valid_profile_id_required');
      const secret = requireSigningKey(signingKey);
      let owner;
      try { owner = await ownerReader(profileId); } catch { return uniformResult; }
      if (!owner?.recipient_email || owner.profile_id !== profileId || !transport?.send) {
        tokenDigest(tokenFactory(), secret, boundAudience);
        return uniformResult;
      }

      const stateLockKey = `${keyPrefix}:profile_state_lock:${profileId}`;
      const stateLock = crypto.randomUUID();
      try {
        if (!await store.setNx(stateLockKey, stateLock, STATE_LOCK_TTL_SECONDS)) return uniformResult;
      } catch {
        return uniformResult;
      }
      try {
        const rawToken = tokenFactory();
        const digest = tokenDigest(rawToken, secret, boundAudience);
        const now = Number(clock());
        const challengeId = `owner_ch_${crypto.randomUUID().replace(/-/gu, '')}`;
        const key = `${keyPrefix}:challenge:${digest}`;
        const latestKey = `${keyPrefix}:latest:${profileId}`;
        const previousDigest = await store.get(latestKey);
        const challenge = {
          version: CHALLENGE_VERSION,
          issuer: ISSUER,
          audience_sha256: audienceSha256,
          challenge_id: challengeId,
          profile_id: profileId,
          status: 'delivery_pending',
          return_path: returnPath(input.return_path),
          issued_at_ms: now,
          expires_at_ms: now + PROFILE_OWNER_CHALLENGE_TTL_SECONDS * 1000,
        };
        await persistChallenge(key, challenge);

        let delivered = false;
        try {
          const result = await transport.send({
            challenge_id: challengeId,
            recipient: owner.recipient_email,
            token: rawToken,
            return_path: challenge.return_path,
          });
          delivered = result?.success !== false;
        } catch {
          delivered = false;
        }
        if (!delivered) {
          await persistChallenge(key, {
            ...challenge,
            status: 'delivery_failed',
            failed_at_ms: Number(clock()),
          });
          return uniformResult;
        }

        const activatedAt = Number(clock());
        await persistChallenge(key, {
          ...challenge,
          status: 'pending',
          delivered_at_ms: activatedAt,
        });
        if (typeof store.setExpiring === 'function') {
          await store.setExpiring(latestKey, digest, PROFILE_OWNER_CHALLENGE_TTL_SECONDS + 60);
        } else {
          await store.set(latestKey, digest);
          await store.expire(latestKey, PROFILE_OWNER_CHALLENGE_TTL_SECONDS + 60);
        }
        if (previousDigest && previousDigest !== digest) {
          const previousKey = `${keyPrefix}:challenge:${previousDigest}`;
          const previous = parse(await store.get(previousKey));
          if (validChallenge(previous, activatedAt)) {
            await persistChallenge(previousKey, {
              ...previous,
              status: 'superseded',
              superseded_at_ms: activatedAt,
            });
          }
        }
      } catch {
        return uniformResult;
      } finally {
        await releaseLock(stateLockKey, stateLock).catch(() => {});
      }
      return uniformResult;
    } finally {
      await applyMinimumResponseDelay(startedAt);
    }
  }

  async function consumeChallenge(rawToken) {
    const secret = requireSigningKey(signingKey);
    const digest = tokenDigest(boundedText(rawToken, 240), secret, boundAudience);
    const key = `${keyPrefix}:challenge:${digest}`;
    const lockKey = `${key}:consume_lock`;
    const lock = crypto.randomUUID();
    if (!await store.setNx(lockKey, lock, STATE_LOCK_TTL_SECONDS)) throw new Error('ownership_verification_failed');
    try {
      const now = Number(clock());
      const initial = parse(await store.get(key));
      if (!validChallenge(initial, now)) throw new Error('ownership_verification_failed');
      const stateLockKey = `${keyPrefix}:profile_state_lock:${initial.profile_id}`;
      const stateLock = crypto.randomUUID();
      if (!await store.setNx(stateLockKey, stateLock, STATE_LOCK_TTL_SECONDS)) {
        throw new Error('ownership_verification_failed');
      }
      try {
        const challenge = parse(await store.get(key));
        const verifiedAt = Number(clock());
        const latestKey = `${keyPrefix}:latest:${initial.profile_id}`;
        const latestDigest = await store.get(latestKey);
        if (!validChallenge(challenge, verifiedAt) || latestDigest !== digest) {
          throw new Error('ownership_verification_failed');
        }
        const claims = {
          version: RECEIPT_VERSION,
          issuer: ISSUER,
          audience: boundAudience,
          purpose: PURPOSE,
          profile_id: challenge.profile_id,
          challenge_receipt_ref: sha256(challenge.challenge_id).slice(0, 32),
          issued_at_ms: verifiedAt,
          expires_at_ms: verifiedAt + PROFILE_OWNER_RECEIPT_TTL_SECONDS * 1000,
        };
        await persistChallenge(key, { ...challenge, status: 'consumed', consumed_at_ms: verifiedAt });
        if (typeof store.compareDel === 'function') await store.compareDel(latestKey, digest);
        else if (await store.get(latestKey) === digest) await store.del(latestKey);
        return {
          profile_id: challenge.profile_id,
          return_path: challenge.return_path,
          receipt: sealReceipt(claims, secret, boundAudience),
          max_age_seconds: PROFILE_OWNER_RECEIPT_TTL_SECONDS,
        };
      } finally {
        await releaseLock(stateLockKey, stateLock).catch(() => {});
      }
    } finally {
      await releaseLock(lockKey, lock).catch(() => {});
    }
  }

  function verifyRequest({ profile_id: value, cookie_header: cookieHeader } = {}) {
    let secret;
    try { secret = requireSigningKey(signingKey); } catch { return false; }
    const expectedProfileId = normalizeProfileId(value);
    if (!expectedProfileId) return false;
    const receipt = readCookies(cookieHeader)[PROFILE_OWNER_COOKIE];
    const claims = verifyReceipt(receipt, secret, Number(clock()), boundAudience);
    return Boolean(claims && claims.profile_id === expectedProfileId);
  }

  return Object.freeze({ requestChallenge, consumeChallenge, verifyRequest });
}

export function verifyProfileOwnerRequest({ profileId, cookieHeader, signingKey, audience, nowMs = Date.now() } = {}) {
  const claims = readVerifiedProfileOwnerRequest({ cookieHeader, signingKey, audience, nowMs });
  return Boolean(claims && claims.profile_id === normalizeProfileId(profileId));
}

export function readVerifiedProfileOwnerRequest({ cookieHeader, signingKey, audience, nowMs = Date.now() } = {}) {
  let secret;
  try { secret = requireSigningKey(signingKey); } catch { return null; }
  let boundAudience;
  try { boundAudience = requireAudience(audience); } catch { return null; }
  const claims = verifyReceipt(readCookies(cookieHeader)[PROFILE_OWNER_COOKIE], secret, nowMs, boundAudience);
  if (!claims) return null;
  return Object.freeze({ profile_id: normalizeProfileId(claims.profile_id) });
}
