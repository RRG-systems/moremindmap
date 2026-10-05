import test from 'node:test';
import assert from 'node:assert/strict';
import { academyPreviewMail } from '../server/athleteAcademyV1/previewMail.js';

const env = Object.freeze({ VERCEL_ENV: 'preview', ATHLETE_ACADEMY_SYNTHETIC_PREVIEW: '1',
  ATHLETE_ACADEMY_NAMESPACE: 'more:athlete-academy:{test-mail-sink-v1}',
  ATHLETE_ACADEMY_SYNTHETIC_MAIL_TO: 'private-qa@example.test' });
const message = Object.freeze({ id: 'fictional-mail-id', email: 'youth-13@test.invalid',
  kind: 'verify_email', subject: 'Confirm your MORE Athlete email',
  text: 'Fictional verification link', token: 'fictional-token' });

test('Production and ordinary adult delivery are unchanged even with a sink configured', () => {
  const transport = value => value;
  assert.equal(academyPreviewMail({ env: { ...env, VERCEL_ENV: 'production',
    ATHLETE_ACADEMY_SYNTHETIC_PREVIEW: '0' }, transport }), transport);
  assert.equal(academyPreviewMail({ env: {}, transport }), transport);
});
for (const target of ['production', 'development', '', undefined]) {
  test(`synthetic delivery is unavailable outside hosted Preview: ${String(target)}`, () => {
    assert.equal(academyPreviewMail({ env: { ...env, VERCEL_ENV: target }, transport: () => {} }), null);
  });
}
for (const namespace of ['', 'more:athlete-academy:v1', 'more:athlete-academy:{customer}',
  'more:athlete-academy:{test-}', 'more:athlete-academy:{test-x}:other',
  'more:athlete-academy:{test-not_supported}']) {
  test(`only an explicitly synthetic namespace is admitted: ${namespace}`, () => {
    assert.equal(academyPreviewMail({ env: { ...env, ATHLETE_ACADEMY_NAMESPACE: namespace },
      transport: () => {} }), null);
  });
}
for (const recipient of ['', 'no-address', 'qa@test.invalid', 'qa@example.test,other@example.test',
  'MORE <qa@example.test>', 'qa@example.test\nBcc:other@example.test']) {
  test(`missing, reserved or ambiguous destination fails closed: ${JSON.stringify(recipient)}`, () => {
    assert.equal(academyPreviewMail({ env: { ...env, ATHLETE_ACADEMY_SYNTHETIC_MAIL_TO: recipient },
      transport: () => {} }), null);
  });
}
test('missing provider transport does not manufacture an email capability', () => {
  assert.equal(academyPreviewMail({ env, transport: null }), null);
});
for (const kind of ['verify_email', 'reset_password', 'guardian_invite']) {
  test(`normal ${kind} mail is routed only to the fixed private sink without identity/token changes`, async () => {
    let delivered, calls = 0;
    const transport = academyPreviewMail({ env, transport: async value => {
      calls++; delivered = value; return { status: 'sent', receipt: 'fictional-receipt' };
    } });
    assert.deepEqual(await transport({ ...message, kind, email: 'guardian-17@test.invalid' }),
      { status: 'sent', receipt: 'fictional-receipt' });
    assert.equal(calls, 1); assert.equal(delivered.email, env.ATHLETE_ACADEMY_SYNTHETIC_MAIL_TO);
    assert.equal(delivered.id, message.id); assert.equal(delivered.kind, kind);
    assert.equal(delivered.token, message.token); assert.equal(delivered.text, message.text);
    assert.equal(delivered.subject, `[SYNTHETIC guardian-17@test.invalid] ${message.subject}`);
    assert.equal(message.email, 'youth-13@test.invalid');
  });
}
for (const email of ['customer@example.test', 'guardian@test.invalid.evil.test',
  'qa@test.invalid,customer@example.test', 'qa\n@test.invalid', 'qa@@test.invalid']) {
  test(`no customer or malformed account can use the sink: ${JSON.stringify(email)}`, () => {
    let calls = 0;
    const transport = academyPreviewMail({ env, transport: () => { calls++; } });
    assert.throws(() => transport({ ...message, email }), /SYNTHETIC_MAIL_SCOPE_REQUIRED/);
    assert.equal(calls, 0);
  });
}
test('unsupported mail purpose is rejected before provider dispatch', () => {
  let calls = 0;
  const transport = academyPreviewMail({ env, transport: () => { calls++; } });
  assert.throws(() => transport({ ...message, kind: 'customer_report' }), /SYNTHETIC_MAIL_SCOPE_REQUIRED/);
  assert.equal(calls, 0);
});
test('provider rejection and unknown outcomes are preserved, never retried by the sink', async () => {
  for (const status of ['rejected', 'unknown']) {
    let calls = 0;
    const transport = academyPreviewMail({ env, transport: async () => { calls++; return { status }; } });
    assert.deepEqual(await transport(message), { status }); assert.equal(calls, 1);
  }
});
test('provider errors are not hidden or converted into accepted delivery', async () => {
  let calls = 0;
  const transport = academyPreviewMail({ env, transport: async () => { calls++; throw Error('fictional-provider-failure'); } });
  await assert.rejects(() => transport(message), /fictional-provider-failure/); assert.equal(calls, 1);
});
