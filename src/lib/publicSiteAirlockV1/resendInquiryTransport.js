/* global process */

export const PUBLIC_INQUIRY_RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DESTINATION_REF = 'server_configured_more_sales_inbox';
const DEFAULT_TIMEOUT_MS = 20_000;

function boundedText(value, max) {
  return [...String(value || '')]
    .filter((character) => {
      const code = character.codePointAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, max);
}

function singleLine(value, max) {
  return boundedText(value, max).replace(/[\r\n]+/gu, ' ');
}

function requireApiKey(value) {
  const apiKey = String(value || '').trim();
  if (!/^re_[A-Za-z0-9_-]{12,240}$/u.test(apiKey)) throw new Error('public_inquiry_resend_key_required');
  return apiKey;
}

function requireMailbox(value, code, { allowDisplayName = false } = {}) {
  const mailbox = singleLine(value, 320);
  const candidate = allowDisplayName
    ? (mailbox.match(/<([^<>]+)>$/u)?.[1] || mailbox)
    : mailbox;
  if (!/^[^\s,@<>]+@[^\s,@<>]+\.[^\s,@<>]+$/u.test(candidate)) throw new Error(code);
  if (!allowDisplayName && mailbox !== candidate) throw new Error(code);
  return mailbox;
}

function requireToken(value, code) {
  const token = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,220}$/u.test(token)) throw new Error(code);
  return token;
}

function normalizeInquiry(item = {}) {
  const receiptId = requireToken(item.receipt_id, 'public_inquiry_receipt_required');
  const outboxId = requireToken(item.outbox_id || `outbox_${receiptId}`, 'public_inquiry_outbox_required');
  const name = singleLine(item.name, 120);
  const phone = singleLine(item.phone, 40);
  const email = requireMailbox(item.email, 'public_inquiry_email_required');
  if (item.destination_ref !== DESTINATION_REF || name.length < 2 || phone.replace(/\D/gu, '').length < 10) {
    throw new Error('public_inquiry_payload_invalid');
  }
  return { receiptId, outboxId, name, phone, email };
}

function inquiryText(inquiry) {
  return [
    'A new Step 4 inquiry was accepted by MORE MindMap.',
    '',
    `Name: ${inquiry.name}`,
    `Phone: ${inquiry.phone}`,
    `Email: ${inquiry.email}`,
    `Receipt: ${inquiry.receiptId}`,
  ].join('\n');
}

export function publicInquiryTransportConfigured(env = process.env) {
  try {
    requireApiKey(env.PUBLIC_INQUIRY_RESEND_API_KEY);
    requireMailbox(env.PUBLIC_INQUIRY_EMAIL_FROM, 'public_inquiry_sender_required', { allowDisplayName: true });
    requireMailbox(env.PUBLIC_INQUIRY_EMAIL_TO, 'public_inquiry_destination_required');
    return true;
  } catch {
    return false;
  }
}

export function createResendInquiryTransport({ apiKey, from, to, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const resolvedApiKey = requireApiKey(apiKey);
  const resolvedFrom = requireMailbox(from, 'public_inquiry_sender_required', { allowDisplayName: true });
  const resolvedTo = requireMailbox(to, 'public_inquiry_destination_required');
  if (typeof fetchImpl !== 'function') throw new Error('public_inquiry_fetch_required');
  const boundedTimeout = Math.min(Math.max(Number(timeoutMs) || DEFAULT_TIMEOUT_MS, 1_000), 20_000);

  return Object.freeze({
    provider: 'resend',
    destination_ref: DESTINATION_REF,
    async send(item) {
      const inquiry = normalizeInquiry(item);
      let response;
      try {
        response = await fetchImpl(PUBLIC_INQUIRY_RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${resolvedApiKey}`,
            'content-type': 'application/json',
            'idempotency-key': inquiry.outboxId,
            'user-agent': 'MORE-MindMap-Public-Inquiry/1.0',
          },
          body: JSON.stringify({
            from: resolvedFrom,
            to: [resolvedTo],
            subject: 'New MORE MindMap Step 4 inquiry',
            text: inquiryText(inquiry),
          }),
          signal: AbortSignal.timeout(boundedTimeout),
        });
      } catch {
        throw new Error('public_inquiry_delivery_failed');
      }
      const parsed = await response.json().catch(() => null);
      if (!response.ok) throw new Error('public_inquiry_delivery_rejected');
      const providerId = singleLine(parsed?.id, 160);
      if (!providerId) throw new Error('public_inquiry_delivery_receipt_invalid');
      return { id: `resend:${providerId}`, provider: 'resend' };
    },
  });
}

export function createResendInquiryTransportFromEnv(env = process.env, options = {}) {
  return createResendInquiryTransport({
    apiKey: env.PUBLIC_INQUIRY_RESEND_API_KEY,
    from: env.PUBLIC_INQUIRY_EMAIL_FROM,
    to: env.PUBLIC_INQUIRY_EMAIL_TO,
    ...options,
  });
}

export const PUBLIC_INQUIRY_TRANSPORT_CONTRACT = Object.freeze({
  endpoint: PUBLIC_INQUIRY_RESEND_ENDPOINT,
  destination_ref: DESTINATION_REF,
  recipient_source: 'server_configuration_only',
  provider_idempotency_key: 'outbox_id',
  raw_provider_payload_persisted: false,
  arbitrary_endpoint_supported: false,
});
