/* global process */
import { boundedText } from './contracts.js';
import { resolvePublicSiteOrigin } from './publicSiteOrigin.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function mailbox(value, { displayName = false } = {}) {
  const normalized = boundedText(value, 320).replace(/[\r\n]+/gu, ' ');
  const candidate = displayName ? (normalized.match(/<([^<>]+)>$/u)?.[1] || normalized) : normalized;
  if (!/^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/u.test(candidate)) return '';
  return displayName || candidate === normalized ? normalized : '';
}

export function publicProfileOwnershipTransportConfigured(env = process.env) {
  const apiKey = String(env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY || '').trim();
  return /^re_[A-Za-z0-9_-]{12,240}$/u.test(apiKey)
    && Boolean(mailbox(env.PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM, { displayName: true }));
}

export function createResendOwnershipTransport({ env = process.env, fetchImpl = fetch } = {}) {
  return Object.freeze({
    async send(item = {}) {
      const apiKey = String(env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY || '').trim();
      const from = mailbox(env.PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM, { displayName: true });
      const recipient = mailbox(item.recipient);
      const challengeId = boundedText(item.challenge_id, 160);
      const token = boundedText(item.token, 240);
      if (!/^re_[A-Za-z0-9_-]{12,240}$/u.test(apiKey)
        || !from
        || !recipient
        || !challengeId
        || !token
        || typeof fetchImpl !== 'function') {
        throw new Error('profile_ownership_transport_unavailable');
      }
      const origin = resolvePublicSiteOrigin(env);
      const route = item.return_path === '/step-2' ? '/step-2' : '/step-1';
      const link = `${origin}${route}#more-profile-owner=${encodeURIComponent(token)}`;
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': challengeId,
          'user-agent': 'MORE-MindMap-Public-Profile-Ownership/1.0',
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: 'Verify your MORE Profile',
          text: `Use this private, single-use link to continue: ${link}\n\nThis link expires in 10 minutes.`,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const parsed = await response.json().catch(() => null);
      return response.ok && Boolean(parsed?.id)
        ? { success: true, id: `resend:${boundedText(parsed.id, 160)}` }
        : { success: false };
    },
  });
}

export const PUBLIC_PROFILE_OWNERSHIP_TRANSPORT = Object.freeze({
  endpoint: RESEND_ENDPOINT,
  recipient_source: 'canonical_profile_top_level_email_only',
  provider_idempotency_key: 'challenge_id',
  raw_token_persisted: false,
});
