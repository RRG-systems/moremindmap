import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRIVATE_RUNTIME_ADVERSARIAL_MATRIX,
  createFailureMatrixResults,
  createPrivateRuntimeRepairReceipt,
  createZeroExternalCallCapture,
  shapePrivateRuntimeEvidence,
  validateCompleteAttachmentSet,
  validatePrivateRuntimeRunbook,
  validateZeroExternalCallCapture,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/evidence.js';
import { PRIVATE_RUNTIME_FAILURE_CODES } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/failureCodes.js';

const scopeHash = 'a'.repeat(64);
const subjectRef = 'canonical_subject_synthetic_alpha';
const sessionRef = 'authenticated_session_synthetic_alpha';
const businessEngineReceipt = {
  receipt_version: 'business-engine-attachment-v1',
  attachment_id: 'business_engine_attachment_synthetic_alpha',
  subscriber_subject_ref: subjectRef,
  exact_scope_hash: scopeHash,
  duplicate_engine_created: false,
  write_authorized: false,
};
const subscriptionReceipt = {
  receipt_version: 'subscription-runtime-attachment-v1',
  attachment_id: 'subscription_runtime_attachment_synthetic_alpha',
  subscriber_subject_ref: subjectRef,
  authenticated_session_ref: sessionRef,
  exact_scope_hash: scopeHash,
  business_engine_attachment_ref: businessEngineReceipt.attachment_id,
  paid_entitlement: false,
  stripe_authority: false,
};
const coachConnectReceipt = {
  receipt_version: 'coach-connect-attachment-v1',
  attachment_id: 'coach_connect_attachment_synthetic_alpha',
  subscriber_subject_ref: subjectRef,
  exact_scope_hash: scopeHash,
  business_engine_attachment_ref: businessEngineReceipt.attachment_id,
  subscription_runtime_attachment_ref: subscriptionReceipt.attachment_id,
  second_business_engine: false,
  canonical_mutation_authority: false,
};
const input = {
  environmentId: 'environment_synthetic_alpha',
  subjectReceipt: {
    subject_receipt_version: 'private-runtime-subject-receipt-v1',
    subscriber_subject_ref: subjectRef,
    exact_scope_hash: scopeHash,
  },
  sessionReceipt: {
    session_receipt_version: 'private-runtime-session-receipt-v1',
    subscriber_subject_ref: subjectRef,
    authenticated_session_ref: sessionRef,
  },
  capability: {
    envelope_version: 'private-runtime-capability-v1',
    subscriber_subject_ref: subjectRef,
    authenticated_session_ref: sessionRef,
    exact_scope_hash: scopeHash,
  },
  businessEngineReceipt,
  subscriptionReceipt,
  coachConnectReceipt,
  createdAt: '2026-07-27T16:04:00.000Z',
  expiresAt: '2026-07-27T16:15:00.000Z',
};

const runbooks = [
  'subject_enrollment.md',
  'login_session.md',
  'runtime_attach.md',
  'restart_recovery.md',
  'logout_revocation.md',
  'emergency_disable.md',
  'incident_response.md',
  'post_enablement_validation.md',
];

test('all 47 adversarial scenarios have stable failure codes and preserve the canonical engine', () => {
  assert.equal(PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.length, 47);
  assert.deepEqual(
    PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.map((entry) => entry.scenario_number),
    Array.from({ length: 47 }, (_, index) => index + 1),
  );
  for (const scenario of PRIVATE_RUNTIME_ADVERSARIAL_MATRIX) {
    assert.equal(PRIVATE_RUNTIME_FAILURE_CODES.includes(scenario.expected_failure_code), true);
    assert.equal(scenario.leaves_partial_attachment, false);
    assert.equal(scenario.preserves_canonical_business_engine, true);
  }
  const results = createFailureMatrixResults();
  assert.equal(results.scenario_count, 47);
  assert.equal(results.passed, 47);
  assert.equal(results.failed, 0);
});

test('complete attachment set publishes only after every receipt and cross-reference agrees', () => {
  const result = validateCompleteAttachmentSet(input);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.attachment_set_version, 'private-runtime-attachment-set-v1');
  assert.equal(result.receipt.all_scopes_equal, true);
  assert.equal(result.receipt.all_authorities_current, true);
  assert.equal(result.receipt.business_engine_count, 1);
  assert.equal(result.receipt.runtime_ready, true);
  assert.equal(result.receipt.public_access, false);
  assert.equal(result.receipt.paid_entitlement, false);
  assert.equal(result.receipt.stripe_enabled, false);
  assert.equal(result.receipt.production_customer_data, false);
});

test('partial, mismatched, stale, or duplicate attachment is discarded and never published', () => {
  const candidates = [
    { ...input, coachConnectReceipt: null },
    {
      ...input,
      subscriptionReceipt: { ...subscriptionReceipt, exact_scope_hash: 'b'.repeat(64) },
    },
    {
      ...input,
      businessEngineReceipt: { ...businessEngineReceipt, duplicate_engine_created: true },
    },
    {
      ...input,
      coachConnectReceipt: { ...coachConnectReceipt, second_business_engine: true },
    },
    {
      ...input,
      expiresAt: input.createdAt,
    },
  ];
  for (const candidate of candidates) {
    const result = validateCompleteAttachmentSet(candidate);
    assert.equal(result.code, 'ATTACHMENT_PARTIAL_FAILURE');
    assert.equal(result.partial_handles_discarded, true);
    assert.equal(result.runtime_ready, false);
    assert.equal('receipt' in result, false);
  }
});

test('external-call capture requires every provider, persistence, Stripe, and deployment count to be zero', () => {
  const capture = createZeroExternalCallCapture();
  assert.equal(validateZeroExternalCallCapture(capture).valid, true);
  for (const field of Object.keys(capture)) {
    assert.equal(validateZeroExternalCallCapture({ ...capture, [field]: 1 }).valid, false);
  }
  assert.equal(validateZeroExternalCallCapture({ ...capture, unknown_call_count: 0 }).valid, false);
});

test('evidence accepts safe hashes/versions/codes and rejects secrets, PII, and private-content canaries', () => {
  const safe = {
    proof_version: 'private-runtime-safe-proof-v1',
    subject_ref_hash: scopeHash,
    failure_code: 'EMERGENCY_DISABLED',
    passed: true,
    call_count: 0,
  };
  assert.equal(shapePrivateRuntimeEvidence(safe).ok, true);
  const canaries = [
    { email: 'canary@example.invalid' },
    { token: 'raw-token-canary' },
    { cookie: 'session=canary' },
    { access_code: 'canary' },
    { business_engine_content: 'canary' },
    { coach_note: 'canary' },
    { transcript: 'canary' },
    { credential: 'canary' },
    { safe_field: 'Bearer canary-token-material-0001' },
    { safe_field: 'sk_live_canarymaterial00001' },
  ];
  for (const canary of canaries) {
    assert.equal(shapePrivateRuntimeEvidence(canary).ok, false);
  }
});

test('repair receipts are privacy-shaped and never weaken a gate', () => {
  const result = createPrivateRuntimeRepairReceipt({
    sprint: 6,
    repair: 1,
    failedGate: 'focused_validation',
    cause: 'synthetic_contract_mismatch',
    changedFiles: ['test/intelligenceFabric.coachConnect.privateRuntime.validation.test.js'],
    validation: 'PASS',
    result: 'PASS',
  });
  assert.equal(result.ok, true);
  assert.equal(result.receipt.result, 'PASS');
  assert.equal(shapePrivateRuntimeEvidence({
    ...result.receipt,
    credential: 'forbidden',
  }).ok, false);
});

test('all eight runbooks contain required sections and no live commands', () => {
  for (const file of runbooks) {
    const text = readFileSync(
      new URL(`../docs/runbooks/coach_connect/private_runtime_enablement/${file}`, import.meta.url),
      'utf8',
    );
    const result = validatePrivateRuntimeRunbook(text);
    assert.equal(result.valid, true, `${file}: ${JSON.stringify(result)}`);
  }
});

test('logout, restart, revocation, emergency, and evidence receipts remain non-enumerating', () => {
  const receipts = [
    {
      receipt_version: 'private-runtime-restart-receipt-v1',
      authoritative_state_revalidated: true,
      stale_process_handles_authorize: false,
    },
    {
      receipt_version: 'private-runtime-logout-receipt-v1',
      capability_revoked: true,
      session_revoked: true,
      cookies_cleared: true,
      runtime_handles_detached: true,
    },
    {
      receipt_version: 'private-runtime-emergency-receipt-v1',
      emergency_disabled: true,
      epoch_advanced: true,
      canonical_business_engine_preserved: true,
    },
  ];
  for (const receipt of receipts) {
    assert.equal(shapePrivateRuntimeEvidence(receipt).ok, true);
    assert.equal(JSON.stringify(receipt).includes('provider_subject'), false);
    assert.equal(JSON.stringify(receipt).includes('profile_synthetic'), false);
  }
});
