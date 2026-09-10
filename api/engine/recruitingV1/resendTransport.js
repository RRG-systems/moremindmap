import { buildConsultingAgreementEmail } from '../../../src/lib/recruitingGuV1/agreementEmail.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function requireBinding(value, code) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function publicBaseUrl(value) {
  const url = new URL(requireBinding(value, 'RECRUITING_PUBLIC_BASE_URL_REQUIRED'));
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('RECRUITING_PUBLIC_BASE_URL_INVALID');
  }
  return url.origin;
}

function safeProviderFailure(status, parsed) {
  const kind = String(parsed?.name || parsed?.code || '').trim().toLowerCase();
  const safeKind = /^[a-z0-9_]{1,80}$/u.test(kind) ? kind : null;
  const message = String(parsed?.message || '').toLowerCase();
  let reason = null;
  if (message.includes('domain') && message.includes('not verified')) reason = 'sender_domain_not_verified';
  else if (message.includes('only send testing emails')) reason = 'test_recipient_restriction';
  else if (message.includes('api key') && message.includes('invalid')) reason = 'invalid_api_key';
  return `resend_status_${status}${safeKind ? `_${safeKind}` : ''}${reason ? `_${reason}` : ''}`;
}

function notificationContent(item, baseUrl) {
  const token = item.delivery_token ? encodeURIComponent(item.delivery_token) : null;
  if (item.kind === 'MANAGER_VERIFICATION') {
    if (!token) throw new Error('RECRUITING_DELIVERY_TOKEN_REQUIRED');
    return {
      subject: 'Your MORE Recruiting sign-in link',
      text: `Use this private link to continue: ${baseUrl}/recruiting/verify/${token}\n\nThis single-use link expires 15 minutes after it was requested.`,
    };
  }
  if (item.kind === 'MANAGER_SETUP') {
    if (!token) throw new Error('RECRUITING_DELIVERY_TOKEN_REQUIRED');
    return {
      subject: 'Set up your MORE Recruiting access',
      text: `Use this private setup link: ${baseUrl}/recruiting/setup/${token}`,
    };
  }
  if (item.kind === 'RECRUIT_INVITATION') {
    if (!token) throw new Error('RECRUITING_DELIVERY_TOKEN_REQUIRED');
    return {
      subject: 'A private invitation from MORE MindMap',
      text: `Review your private invitation and consent before continuing: ${baseUrl}/recruiting/accept/${token}`,
    };
  }
  if (item.kind === 'RECRUIT_CURRENT_CONSENT') {
    if (!token) throw new Error('RECRUITING_DELIVERY_TOKEN_REQUIRED');
    return {
      subject: 'Review current consent for your MORE recruiting relationship',
      text: `Review the current consent terms for your existing recruiting relationship. Your completed results remain unchanged: ${baseUrl}/recruiting/accept/${token}`,
    };
  }
  if (item.kind === 'CONSULTATION_APPROVAL') {
    if (!token) throw new Error('RECRUITING_DELIVERY_TOKEN_REQUIRED');
    return {
      subject: 'Someone would like to open a MORE consultation with you',
      text: `You control whether your MORE profile is used in this consultation. Review the request and decide here: ${baseUrl}/recruiting-gu-v1/approve/${token}\n\nYour MORE ID alone did not grant access. This single-use approval link expires automatically.`,
    };
  }
  if (item.kind === 'CONSULTING_AGREED_PLAN') {
    return buildConsultingAgreementEmail({ acceptedPlanSnapshot: item.payload?.accepted_plan_snapshot });
  }
  if (item.kind === 'MANAGER_BOS_READY' || item.kind === 'MANAGER_BA_INTELLIGENCE_READY') {
    return {
      subject: item.kind === 'MANAGER_BOS_READY'
        ? 'Candidate BOS is ready'
        : 'Candidate business intelligence is ready',
      text: `Open your private Recruiting workspace: ${baseUrl}/recruiting/home`,
    };
  }
  throw new Error('RECRUITING_NOTIFICATION_KIND_UNSUPPORTED');
}

export function createResendRecruitingTransport({ apiKey, from, baseUrl, fetchImpl = fetch } = {}) {
  const resolvedApiKey = requireBinding(apiKey, 'RECRUITING_RESEND_API_KEY_REQUIRED');
  const resolvedFrom = requireBinding(from, 'RECRUITING_EMAIL_FROM_REQUIRED');
  const resolvedBaseUrl = publicBaseUrl(baseUrl);
  if (typeof fetchImpl !== 'function') throw new Error('RECRUITING_NOTIFICATION_FETCH_REQUIRED');
  return Object.freeze({
    provider: 'resend',
    synthetic: false,
    async deliver(item) {
      const recipient = requireBinding(item?.recipient, 'RECRUITING_NOTIFICATION_RECIPIENT_REQUIRED');
      const outboxId = requireBinding(item?.outbox_id, 'RECRUITING_OUTBOX_ID_REQUIRED');
      const content = notificationContent(item, resolvedBaseUrl);
      try {
        const response = await fetchImpl(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${resolvedApiKey}`,
            'content-type': 'application/json',
            'idempotency-key': outboxId,
            'user-agent': 'MORE-MindMap-Recruiting-V1/1.0',
          },
          body: JSON.stringify({
            from: resolvedFrom,
            to: [recipient],
            subject: content.subject,
            text: content.text,
            ...(content.html ? { html: content.html } : {}),
          }),
          signal: AbortSignal.timeout(20_000),
        });
        const parsed = await response.json().catch(() => null);
        if (!response.ok || !parsed?.id) return { success: false, receipt: safeProviderFailure(response.status, parsed) };
        return { success: true, receipt: `resend:${String(parsed.id).slice(0, 180)}` };
      } catch {
        return { success: false, receipt: 'resend_transport_failure' };
      }
    },
  });
}

export const RECRUITING_RESEND_TRANSPORT = Object.freeze({
  endpoint: RESEND_ENDPOINT,
  exact_recipient_only: true,
  provider_idempotency_key: 'outbox_id',
  raw_provider_payload_persisted: false,
});
