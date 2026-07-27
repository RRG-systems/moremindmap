import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachCanonicalBusinessEngine,
  validateCanonicalBusinessEngineAttachmentPort,
  validatePrivateRuntimeAttachmentRequest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const scope = {
  tenant_id: 'tenant_synthetic_alpha',
  profile_id: 'profile_synthetic_alpha',
  business_id: 'business_synthetic_alpha',
  subscriber_id: 'subscriber_synthetic_alpha',
};
const request = {
  request_version: 'private-runtime-attachment-request-v1',
  environment_id: 'environment_synthetic_alpha',
  subscriber_subject_ref: 'canonical_subject_synthetic_alpha',
  authenticated_session_ref: 'authenticated_session_synthetic_alpha',
  capability_ref: 'capability_synthetic_alpha',
  exact_scope: scope,
  requested_attachments: ['BUSINESS_ENGINE', 'SUBSCRIPTION_RUNTIME', 'COACH_CONNECT'],
  correlation_id: 'correlation_attachment_synthetic_alpha',
  requested_at: '2026-07-27T16:01:00.000Z',
};
const subjectReceipt = {
  subject_receipt_version: 'private-runtime-subject-receipt-v1',
  subscriber_subject_ref: request.subscriber_subject_ref,
  exact_scope_hash: hashPrivateRuntimeScope(scope),
};
const engine = {
  source: 'CANONICAL_BUSINESS_ENGINE',
  exact_scope: scope,
  business_engine_ref: 'canonical_business_engine_synthetic_alpha',
  business_engine_version: 'business_engine_contract_v1',
  business_engine_contract_hash: 'a'.repeat(64),
  write_authorized: false,
};
const authority = { allowed: true, authority_fingerprint: 'authority_synthetic_alpha' };

function port(engines = [engine], overrides = {}) {
  let calls = 0;
  return {
    async lookupCanonicalBusinessEngine() {
      calls += 1;
      return { ok: true, engines: structuredClone(engines) };
    },
    describeCapability() {
      return {
        canonical_source_only: true,
        read_only: true,
        can_build_engine: false,
        can_persist_engine: false,
        production_connection: false,
        ...overrides,
      };
    },
    calls() { return calls; },
  };
}

const attach = (input = {}) => attachCanonicalBusinessEngine({
  port: port(),
  request,
  authority,
  subjectReceipt,
  attachedAt: '2026-07-27T16:01:01.000Z',
  ...input,
});

test('exact attachment request and read-only canonical port validate', () => {
  assert.equal(validatePrivateRuntimeAttachmentRequest(request).valid, true);
  assert.equal(validateCanonicalBusinessEngineAttachmentPort(port()).valid, true);
  assert.equal(validatePrivateRuntimeAttachmentRequest({
    ...request,
    subscription_id: 'not_an_identity_input',
  }).valid, false);
});

test('one exact canonical Business Engine attaches deterministically by reference/version/hash', async () => {
  const first = await attach();
  const repeat = await attach();
  assert.equal(first.ok, true);
  assert.deepEqual(repeat, first);
  assert.equal(first.receipt.source, 'CANONICAL_BUSINESS_ENGINE');
  assert.equal(first.receipt.write_authorized, false);
  assert.equal(first.receipt.duplicate_engine_created, false);
  assert.equal(first.inspection.business_engine_count, 1);
});

test('missing authority, subject, session, and exact scope binding deny', async () => {
  assert.equal((await attach({ authority: { allowed: false, code: 'SESSION_ELEVATION_REQUIRED' } })).code, 'SESSION_ELEVATION_REQUIRED');
  assert.equal((await attach({
    subjectReceipt: { ...subjectReceipt, subscriber_subject_ref: 'canonical_subject_other' },
  })).code, 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH');
  assert.equal((await attach({
    request: { ...request, authenticated_session_ref: '' },
  })).ok, false);
  const otherScope = { ...scope, business_id: 'business_synthetic_other' };
  assert.equal((await attach({
    request: { ...request, exact_scope: otherScope },
  })).code, 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH');
});

test('zero or two canonical engines deny without publishing a handle', async () => {
  const none = await attach({ port: port([]) });
  const duplicate = await attach({ port: port([engine, { ...engine, business_engine_ref: 'canonical_business_engine_other' }]) });
  assert.deepEqual(none, { ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND' });
  assert.deepEqual(duplicate, { ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_AMBIGUOUS' });
  assert.equal('receipt' in none, false);
  assert.equal('receipt' in duplicate, false);
});

test('wrong source, version, hash, scope, payload, or write authority denies', async () => {
  const invalid = [
    { ...engine, source: 'DEVELOPER_BUSINESS_ENGINE' },
    { ...engine, business_engine_version: '' },
    { ...engine, business_engine_contract_hash: 'bad' },
    { ...engine, exact_scope: { ...scope, profile_id: 'profile_synthetic_other' } },
    { ...engine, payload: { forbidden: true } },
    { ...engine, business_engine_contract: { forbidden: true } },
    { ...engine, write_authorized: true },
  ];
  for (const candidate of invalid) {
    assert.equal((await attach({ port: port([candidate]) })).code, 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH');
  }
});

test('bridge output retains no payload, does not change Profile ID, and grants no promotion authority', async () => {
  const result = await attach();
  const serialized = JSON.stringify(result);
  assert.equal(result.inspection.payload_retained, false);
  assert.equal(result.inspection.profile_id_changed, false);
  assert.equal(result.inspection.canonical_mutation_authority, false);
  assert.equal(serialized.includes('business_engine_contract'), true);
  assert.equal(serialized.includes('forbidden'), false);
  assert.equal('exact_scope' in result.receipt, false);
});

test('noncanonical or persistence-capable ports are rejected before lookup', async () => {
  for (const overrides of [
    { canonical_source_only: false },
    { read_only: false },
    { can_build_engine: true },
    { can_persist_engine: true },
    { production_connection: true },
  ]) {
    const candidate = port([engine], overrides);
    const result = await attach({ port: candidate });
    assert.equal(result.code, 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND');
    assert.equal(candidate.calls(), 0);
  }
});
