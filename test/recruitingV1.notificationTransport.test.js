import assert from 'node:assert/strict';
import test from 'node:test';

import { createResendRecruitingTransport } from '../api/engine/recruitingV1/resendTransport.js';

test('Resend transport uses the exact recipient and outbox idempotency without persisting raw provider data', async () => {
  const calls = [];
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://preview.example.test',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, async json() { return { id: 'email_synthetic_123' }; } };
    },
  });
  const outcome = await transport.deliver({
    outbox_id: 'outbox_exact_recipient_1',
    kind: 'RECRUIT_INVITATION',
    recipient: 'only.this.person@example.test',
    delivery_token: 'opaque-synthetic-token',
  });
  assert.deepEqual(outcome, { success: true, receipt: 'resend:email_synthetic_123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers['idempotency-key'], 'outbox_exact_recipient_1');
  assert.equal(calls[0].init.headers['user-agent'], 'MORE-MindMap-Recruiting-V1/1.0');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.to, ['only.this.person@example.test']);
  assert.equal(body.text.includes('opaque-synthetic-token'), true);
  assert.equal(JSON.stringify(outcome).includes('opaque-synthetic-token'), false);
  assert.equal(JSON.stringify(outcome).includes('only.this.person@example.test'), false);
});

test('manager verification email carries the public route, opaque token, and explicit 15-minute expiry', async () => {
  const calls = [];
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://more.example.test',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, async json() { return { id: 'email_manager_verification' }; } };
    },
  });
  const outcome = await transport.deliver({
    outbox_id: 'outbox_manager_verification',
    kind: 'MANAGER_VERIFICATION',
    recipient: 'manager@example.test',
    delivery_token: 'opaque-manager-token',
  });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(outcome.success, true);
  assert.match(body.text, /https:\/\/more\.example\.test\/recruiting\/verify\/opaque-manager-token/u);
  assert.match(body.text, /expires 15 minutes after it was requested/u);
});

test('current-consent email uses the same private acceptance route and promises no result replacement', async () => {
  const calls = [];
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://preview.example.test',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, async json() { return { id: 'email_current_consent' }; } };
    },
  });
  const outcome = await transport.deliver({
    outbox_id: 'outbox_current_consent',
    kind: 'RECRUIT_CURRENT_CONSENT',
    recipient: 'existing.person@example.test',
    delivery_token: 'opaque-current-consent-token',
  });
  const body = JSON.parse(calls[0].init.body);
  assert.equal(outcome.success, true);
  assert.match(body.subject, /current consent/u);
  assert.match(body.text, /\/recruiting\/accept\/opaque-current-consent-token/u);
  assert.match(body.text, /completed results remain unchanged/u);
});

test('Resend transport fails closed for unsupported notification kinds and sanitizes provider failure', async () => {
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://preview.example.test',
    fetchImpl: async () => ({ ok: false, status: 429, async json() { return { message: 'sensitive provider detail' }; } }),
  });
  await assert.rejects(
    transport.deliver({ outbox_id: 'outbox_bad_kind', kind: 'UNKNOWN_KIND', recipient: 'recipient@example.test' }),
    /NOTIFICATION_KIND_UNSUPPORTED/,
  );
  const failed = await transport.deliver({
    outbox_id: 'outbox_rate_limited',
    kind: 'MANAGER_BOS_READY',
    recipient: 'recipient@example.test',
  });
  assert.deepEqual(failed, { success: false, receipt: 'resend_status_429' });
});

test('Resend transport preserves only the provider error class for bounded diagnosis', async () => {
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://preview.example.test',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() { return { name: 'invalid_api_key', message: 'must never be persisted' }; },
    }),
  });
  const failed = await transport.deliver({
    outbox_id: 'outbox_invalid_key',
    kind: 'MANAGER_BOS_READY',
    recipient: 'recipient@example.test',
  });
  assert.deepEqual(failed, { success: false, receipt: 'resend_status_403_invalid_api_key' });
  assert.equal(JSON.stringify(failed).includes('must never be persisted'), false);
});

test('Resend transport classifies a sender-domain mismatch without persisting provider prose', async () => {
  const transport = createResendRecruitingTransport({
    apiKey: 'synthetic-provider-key-not-a-secret',
    from: 'MORE Recruiting <recruiting@example.test>',
    baseUrl: 'https://preview.example.test',
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() { return { name: 'validation_error', message: 'The sensitive.example domain is not verified.' }; },
    }),
  });
  const failed = await transport.deliver({
    outbox_id: 'outbox_domain_mismatch',
    kind: 'MANAGER_BOS_READY',
    recipient: 'recipient@example.test',
  });
  assert.deepEqual(failed, { success: false, receipt: 'resend_status_403_validation_error_sender_domain_not_verified' });
  assert.equal(JSON.stringify(failed).includes('sensitive.example'), false);
});
