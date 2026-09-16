import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  FULL_PERSON_QA_CAPABILITY_CONTRACT,
  FULL_PERSON_QA_CAPABILITY_COOKIE,
  FULL_PERSON_QA_CAPABILITY_TTL_SECONDS,
  FULL_PERSON_QA_CASE_VERTICALS,
  FULL_PERSON_QA_CUSTODY_VERSION,
  FULL_PERSON_QA_HMAC_DOMAINS,
  FULL_PERSON_QA_MANIFEST_COUNT,
  FULL_PERSON_QA_MANIFEST_VERSION,
  FULL_PERSON_QA_SYNTHETIC_LABEL,
  FULL_PERSON_QA_VERTICAL_AUTHORITY_VERSION,
  clearFullPersonQaCapabilityCookie,
  fullPersonQaAssessmentDigest,
  fullPersonQaBaRealizationIdDigest,
  fullPersonQaBosRealizationIdDigest,
  fullPersonQaCapabilityCookiePresent,
  fullPersonQaCapabilityLookup,
  fullPersonQaCustodySha256,
  fullPersonQaProfileDigest,
  fullPersonQaSyntheticProvenance,
  fullPersonQaSyntheticProvenanceSha256,
  fullPersonQaVerticalAuthoritySha256,
  issueFullPersonQaCapability,
  parseFullPersonQaManifest,
  resolveFullPersonQaManifestEntry,
  verifyFullPersonQaCapability,
} from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import { canonicalJson, hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const NOW = new Date('2026-09-13T18:00:00.000Z');
const EXPIRES = '2026-09-30T00:00:00.000Z';
const DIGEST_KEY = 'full-person-qa-digest-key-for-focused-tests-0000000000000001';
const SIGNING_KEY = 'full-person-qa-signing-key-for-focused-tests-00000000000001';
const TOKEN = 'A'.repeat(43);
const CASES = Object.freeze([
  Object.freeze({
    case_id: 'COHORT-V1-RE-A',
    vertical_id: 'real_estate',
    profile_id: 'mm-20260913-a1b2c3d4',
    assessment_id: 'ba-20260913-a1b2c3d4',
  }),
  Object.freeze({
    case_id: 'COHORT-V1-RE-B',
    vertical_id: 'real_estate',
    profile_id: 'mm-20260913-b2c3d4e5',
    assessment_id: 'ba-20260913-b2c3d4e5',
  }),
  Object.freeze({
    case_id: 'COHORT-V1-LO-A',
    vertical_id: 'loan_originator',
    profile_id: 'mm-20260913-c3d4e5f6',
    assessment_id: 'ba-20260913-c3d4e5f6',
  }),
  Object.freeze({
    case_id: 'COHORT-V1-LO-B',
    vertical_id: 'loan_originator',
    profile_id: 'mm-20260913-d4e5f6a7',
    assessment_id: 'ba-20260913-d4e5f6a7',
  }),
]);
const MANIFEST_KEYS = Object.freeze([
  'assessment_digest',
  'assessment_evidence_sha256',
  'authority_id',
  'ba_artifact_sha256',
  'ba_envelope_sha256',
  'ba_realization_id_digest',
  'ba_realization_identity_sha256',
  'bos_artifact_sha256',
  'bos_canonical_source_sha256',
  'bos_envelope_sha256',
  'bos_realization_id_digest',
  'bos_realization_identity_sha256',
  'canonical_profile_artifact_sha256',
  'case_id',
  'custody_sha256',
  'expires_at',
  'profile_digest',
  'status',
  'synthetic_provenance_sha256',
  'vertical_authority_sha256',
  'vertical_binding_sha256',
  'vertical_id',
]);
const CUSTODY_HASH_FIELDS = Object.freeze([
  'assessment_digest',
  'assessment_evidence_sha256',
  'ba_artifact_sha256',
  'ba_envelope_sha256',
  'ba_realization_id_digest',
  'ba_realization_identity_sha256',
  'bos_artifact_sha256',
  'bos_canonical_source_sha256',
  'bos_envelope_sha256',
  'bos_realization_id_digest',
  'bos_realization_identity_sha256',
  'canonical_profile_artifact_sha256',
  'profile_digest',
  'synthetic_provenance_sha256',
  'vertical_authority_sha256',
  'vertical_binding_sha256',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function hmac(domain, value, secret) {
  return crypto.createHmac('sha256', secret)
    .update(domain, 'utf8')
    .update('\0', 'utf8')
    .update(String(value), 'utf8')
    .digest('hex');
}

function baRealizationId(fixture) {
  return `new-ba:${fixture.profile_id.toUpperCase()}:${fixture.assessment_id.toUpperCase()}:${sha256(`fake-ba-realization:${fixture.case_id}`)}`;
}

function bosRealizationId(fixture) {
  return `new-bos:${fixture.profile_id.toUpperCase()}:${sha256(`fake-bos-realization:${fixture.case_id}`)}`;
}

function reseal(entry) {
  entry.custody_sha256 = fullPersonQaCustodySha256(entry);
  return entry;
}

function verticalAuthorityBinding(fixture, selectedAt = '2026-09-13T18:01:00.000Z') {
  return {
    binding_version: 'ba-vertical-binding-v1',
    selection_contract_version: 'ba-vertical-selection-v1',
    vertical_id: fixture.vertical_id,
    vertical_label: fixture.vertical_id === 'real_estate' ? 'Real Estate' : 'Loan Originator',
    cassette_id: `${fixture.vertical_id}-cassette-v1`,
    cassette_version: '1.0.0',
    cassette_manifest_sha256: sha256(`fake-cassette-manifest:${fixture.vertical_id}`),
    cassette_registry_sha256: sha256(`fake-cassette-registry:${fixture.vertical_id}`),
    intake_contract_id: `${fixture.vertical_id}-intake-v1`,
    intake_contract_version: '1.0.0',
    intake_contract_sha256: sha256(`fake-intake:${fixture.vertical_id}`),
    evidence_contract_id: `${fixture.vertical_id}-evidence-v1`,
    evidence_contract_version: '1.0.0',
    evidence_contract_sha256: sha256(`fake-evidence:${fixture.vertical_id}`),
    box_1_projection_contract_id: `${fixture.vertical_id}-projection-v1`,
    box_1_projection_contract_version: '1.0.0',
    box_1_projection_adapter_id: `${fixture.vertical_id}-adapter-v1`,
    box_1_projection_contract_sha256: sha256(`fake-projection:${fixture.vertical_id}`),
    selected_at: selectedAt,
    selection_source: 'CUSTOMER_CONFIRMED',
    historical_confirmation_time: 'KNOWN',
  };
}

function manifestEntry(fixture) {
  const authorityId = `synthetic_qa_authority_${sha256(`fake-authority:${fixture.case_id}`).slice(0, 24)}`;
  return reseal({
    authority_id: authorityId,
    case_id: fixture.case_id,
    profile_digest: fullPersonQaProfileDigest(fixture.profile_id, DIGEST_KEY),
    assessment_digest: fullPersonQaAssessmentDigest(fixture.assessment_id, DIGEST_KEY),
    vertical_id: fixture.vertical_id,
    vertical_authority_sha256: fullPersonQaVerticalAuthoritySha256(verticalAuthorityBinding(
      fixture,
      `2026-09-13T18:0${fixture.case_id.endsWith('A') ? '1' : '2'}:00.000Z`,
    )),
    vertical_binding_sha256: sha256(`fake-vertical-binding:${fixture.case_id}`),
    canonical_profile_artifact_sha256: sha256(`fake-profile-artifact:${fixture.case_id}`),
    bos_canonical_source_sha256: sha256(`fake-bos-canonical-source:${fixture.case_id}`),
    assessment_evidence_sha256: sha256(`fake-assessment-evidence:${fixture.case_id}`),
    ba_realization_id_digest: fullPersonQaBaRealizationIdDigest(
      baRealizationId(fixture),
      DIGEST_KEY,
    ),
    ba_realization_identity_sha256: sha256(`fake-ba-identity:${fixture.case_id}`),
    ba_artifact_sha256: sha256(`fake-ba-artifact:${fixture.case_id}`),
    ba_envelope_sha256: sha256(`fake-ba-envelope:${fixture.case_id}`),
    bos_realization_id_digest: fullPersonQaBosRealizationIdDigest(
      bosRealizationId(fixture),
      DIGEST_KEY,
    ),
    bos_realization_identity_sha256: sha256(`fake-bos-identity:${fixture.case_id}`),
    bos_artifact_sha256: sha256(`fake-bos-artifact:${fixture.case_id}`),
    bos_envelope_sha256: sha256(`fake-bos-envelope:${fixture.case_id}`),
    expires_at: EXPIRES,
    status: 'active',
    synthetic_provenance_sha256: fullPersonQaSyntheticProvenanceSha256(
      fullPersonQaSyntheticProvenance({ authority_id: authorityId, case_id: fixture.case_id }),
    ),
  });
}

function manifestEntries() {
  return CASES.map(manifestEntry);
}

function manifest(mutator = (entries) => entries) {
  return JSON.stringify(mutator(manifestEntries()));
}

function request(cookie = '', {
  address = '203.0.113.17',
  userAgent = 'Full Person QA test browser',
} = {}) {
  return {
    method: 'POST',
    headers: {
      host: 'preview.moremindmap.test',
      origin: 'https://preview.moremindmap.test',
      'x-vercel-forwarded-for': address,
      'x-forwarded-for': address,
      'x-forwarded-proto': 'https',
      'user-agent': userAgent,
      cookie,
    },
    socket: {},
  };
}

function throwsCode(operation, code) {
  assert.throws(operation, (error) => error?.code === code);
}

function cookiePair(setCookie) {
  return setCookie.split(';')[0];
}

function receiptEntry(receipt) {
  return {
    assessment_digest: receipt.assessment_digest,
    assessment_evidence_sha256: receipt.assessment_evidence_sha256,
    authority_id: receipt.authority_id,
    ba_artifact_sha256: receipt.ba_artifact_sha256,
    ba_envelope_sha256: receipt.ba_envelope_sha256,
    ba_realization_id_digest: receipt.ba_realization_id_digest,
    ba_realization_identity_sha256: receipt.ba_realization_identity_sha256,
    bos_artifact_sha256: receipt.bos_artifact_sha256,
    bos_canonical_source_sha256: receipt.bos_canonical_source_sha256,
    bos_envelope_sha256: receipt.bos_envelope_sha256,
    bos_realization_id_digest: receipt.bos_realization_id_digest,
    bos_realization_identity_sha256: receipt.bos_realization_identity_sha256,
    canonical_profile_artifact_sha256: receipt.canonical_profile_artifact_sha256,
    case_id: receipt.case_id,
    expires_at: receipt.authority_expires_at,
    profile_digest: receipt.profile_digest,
    status: 'active',
    synthetic_provenance_sha256: receipt.synthetic_provenance_sha256,
    vertical_authority_sha256: receipt.vertical_authority_sha256,
    vertical_binding_sha256: receipt.vertical_binding_sha256,
    vertical_id: receipt.vertical_id,
  };
}

function resignReceipt(receipt) {
  const { signature: ignored, ...claims } = receipt;
  void ignored;
  return {
    ...claims,
    signature: hmac(
      FULL_PERSON_QA_HMAC_DOMAINS.receipt_signature,
      canonicalJson(claims),
      SIGNING_KEY,
    ),
  };
}

function issue({ rawManifest = manifest(), profileId = CASES[0].profile_id } = {}) {
  return issueFullPersonQaCapability({
    profile_id: profileId,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req: request(),
    now: NOW,
    token_factory: () => TOKEN,
  });
}

function verify({ issued, rawManifest, req = request(cookiePair(issued.cookie)), now = NOW } = {}) {
  return verifyFullPersonQaCapability({
    req,
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now,
  });
}

test('v3 manifest accepts only the order-independent exact four-case vertical set', () => {
  const raw = manifest();
  const parsed = parseFullPersonQaManifest(raw);
  const reordered = parseFullPersonQaManifest(manifest((entries) => entries.reverse()));
  const expectedCases = Object.keys(FULL_PERSON_QA_CASE_VERTICALS).sort();

  assert.equal(FULL_PERSON_QA_MANIFEST_VERSION, 'subscription_v1_full_person_qa_manifest_v3');
  assert.equal(FULL_PERSON_QA_CAPABILITY_CONTRACT, 'subscription_v1_full_person_qa_capability_v3');
  assert.equal(parsed.entries.length, FULL_PERSON_QA_MANIFEST_COUNT);
  assert.equal(parsed.contract, FULL_PERSON_QA_MANIFEST_VERSION);
  assert.equal(parsed.manifest_version, FULL_PERSON_QA_MANIFEST_VERSION);
  assert.match(parsed.manifest_sha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(parsed.entries.map((entry) => entry.case_id), expectedCases);
  assert.deepEqual(
    Object.fromEntries(parsed.entries.map((entry) => [entry.case_id, entry.vertical_id])),
    FULL_PERSON_QA_CASE_VERTICALS,
  );
  assert.notEqual(
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-RE-A').vertical_binding_sha256,
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-RE-B').vertical_binding_sha256,
  );
  assert.notEqual(
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-LO-A').vertical_binding_sha256,
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-LO-B').vertical_binding_sha256,
  );
  assert.equal(
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-RE-A').vertical_authority_sha256,
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-RE-B').vertical_authority_sha256,
  );
  assert.equal(
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-LO-A').vertical_authority_sha256,
    parsed.entries.find(({ case_id: caseId }) => caseId === 'COHORT-V1-LO-B').vertical_authority_sha256,
  );
  assert.deepEqual(Object.keys(parsed.entries[0]).sort(), MANIFEST_KEYS);
  assert.equal(reordered.manifest_sha256, parsed.manifest_sha256);
  assert.deepEqual(reordered.entries, parsed.entries);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.entries), true);
  assert.equal(Object.isFrozen(parsed.entries[0]), true);

  for (const fixture of CASES) {
    assert.equal(raw.includes(fixture.profile_id), false);
    assert.equal(raw.includes(fixture.assessment_id), false);
    assert.equal(raw.includes(baRealizationId(fixture)), false);
    assert.equal(raw.includes(bosRealizationId(fixture)), false);
  }
});

test('v3 manifest fails closed on syntax, count, extra or missing fields, and raw IDs or names', () => {
  throwsCode(
    () => parseFullPersonQaManifest(''),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_REQUIRED',
  );
  throwsCode(
    () => parseFullPersonQaManifest('{'),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(JSON.stringify({ entries: manifestEntries() })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID',
  );
  for (const count of [0, 5]) {
    const entries = manifestEntries();
    if (count === 5) entries.push({ ...entries[0] });
    throwsCode(
      () => parseFullPersonQaManifest(JSON.stringify(entries.slice(0, count))),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_COUNT_INVALID',
    );
  }

  const forbiddenRawFields = {
    assessment_id: CASES[0].assessment_id,
    ba_realization_id: baRealizationId(CASES[0]),
    bos_realization_id: bosRealizationId(CASES[0]),
    display_name: 'Synthetic Person Alpha',
    name: 'Synthetic Person Alpha',
    profile_id: CASES[0].profile_id,
  };
  for (const [field, value] of Object.entries(forbiddenRawFields)) {
    throwsCode(
      () => parseFullPersonQaManifest(manifest((entries) => {
        entries[0][field] = value;
        return entries;
      })),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID',
    );
  }
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      delete entries[0].bos_artifact_sha256;
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].authority_id = CASES[0].profile_id;
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_AUTHORITY_INVALID',
  );
});

test('v3 manifest enforces exact case identities, vertical mapping, authority, state, and timestamps', () => {
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].case_id = 'COHORT-V1-RE-C';
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CASE_SET_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].vertical_id = 'loan_originator';
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].vertical_authority_sha256 = sha256('fake-drifted-re-authority');
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_AUTHORITY_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[2].vertical_authority_sha256 = entries[0].vertical_authority_sha256;
      entries[3].vertical_authority_sha256 = entries[0].vertical_authority_sha256;
      reseal(entries[2]);
      reseal(entries[3]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_VERTICAL_AUTHORITY_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].authority_id = 'placeholder_authority';
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_AUTHORITY_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].status = 'ACTIVE';
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_STATUS_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].expires_at = '2026-09-30T00:00:00Z';
      reseal(entries[0]);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_EXPIRY_INVALID',
  );
});

test('v3 custody seal is deterministic, versioned, composite, and rejects placeholders or drift', () => {
  const entry = manifestEntries()[0];
  const { custody_sha256: ignored, ...unsealed } = entry;
  void ignored;
  const expected = hashCanonicalJson({
    ...unsealed,
    custody_version: FULL_PERSON_QA_CUSTODY_VERSION,
  });

  assert.equal(fullPersonQaCustodySha256(unsealed), expected);
  assert.equal(fullPersonQaCustodySha256({ ignored_extra: true, ...unsealed }), expected);
  assert.match(entry.custody_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    FULL_PERSON_QA_VERTICAL_AUTHORITY_VERSION,
    'subscription_v1_full_person_qa_vertical_authority_v1',
  );
  assert.equal(
    fullPersonQaVerticalAuthoritySha256(verticalAuthorityBinding(CASES[0], '2026-09-13T18:01:00.000Z')),
    fullPersonQaVerticalAuthoritySha256(verticalAuthorityBinding(CASES[0], '2026-09-13T18:02:00.000Z')),
  );
  assert.notEqual(
    fullPersonQaVerticalAuthoritySha256(verticalAuthorityBinding(CASES[0])),
    fullPersonQaVerticalAuthoritySha256(verticalAuthorityBinding(CASES[2])),
  );
  throwsCode(
    () => fullPersonQaVerticalAuthoritySha256({ vertical_id: 'real_estate' }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_VERTICAL_AUTHORITY_BINDING_INVALID',
  );

  for (const field of CUSTODY_HASH_FIELDS) {
    const code = field === 'profile_digest'
      ? 'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DIGEST_INVALID'
      : 'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CUSTODY_FIELD_INVALID';
    throwsCode(
      () => parseFullPersonQaManifest(manifest((entries) => {
        entries[0][field] = '0'.repeat(64);
        return entries;
      })),
      code,
    );
  }
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].custody_sha256 = 'f'.repeat(64);
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CUSTODY_INVALID',
  );
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[0].ba_artifact_sha256 = sha256('fake-selected-ba-artifact-drift');
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CUSTODY_INVALID',
  );

  const validReplacement = parseFullPersonQaManifest(manifest((entries) => {
    entries[0].ba_artifact_sha256 = sha256('fake-selected-ba-artifact-replacement');
    reseal(entries[0]);
    return entries;
  }));
  assert.notEqual(validReplacement.entries.find(
    ({ case_id: caseId }) => caseId === CASES[0].case_id,
  ).custody_sha256, entry.custody_sha256);
});

test('v3 manifest rejects duplicates across every identity, digest, and seal field', () => {
  const uniqueFields = Object.freeze([
    'authority_id',
    'case_id',
    ...CUSTODY_HASH_FIELDS.filter((field) => ![
      'vertical_authority_sha256',
      'vertical_binding_sha256',
    ].includes(field)),
  ]);
  for (const field of uniqueFields) {
    throwsCode(
      () => parseFullPersonQaManifest(manifest((entries) => {
        entries[1][field] = entries[0][field];
        if (field === 'case_id') entries[1].vertical_id = entries[0].vertical_id;
        reseal(entries[1]);
        return entries;
      })),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE',
    );
  }
  throwsCode(
    () => parseFullPersonQaManifest(manifest((entries) => {
      entries[1] = { ...entries[0] };
      return entries;
    })),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_DUPLICATE',
  );
});

test('raw identity digests are keyed, normalized where required, and use four distinct HMAC domains', () => {
  const fixture = CASES[0];
  const baId = baRealizationId(fixture);
  const bosId = bosRealizationId(fixture);
  const profileDigest = fullPersonQaProfileDigest(fixture.profile_id, DIGEST_KEY);
  const assessmentDigest = fullPersonQaAssessmentDigest(fixture.assessment_id, DIGEST_KEY);
  const baDigest = fullPersonQaBaRealizationIdDigest(baId, DIGEST_KEY);
  const bosDigest = fullPersonQaBosRealizationIdDigest(bosId, DIGEST_KEY);

  assert.equal(profileDigest, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.profile_digest,
    fixture.profile_id,
    DIGEST_KEY,
  ));
  assert.equal(assessmentDigest, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.assessment_digest,
    fixture.assessment_id,
    DIGEST_KEY,
  ));
  assert.equal(baDigest, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.ba_realization_id_digest,
    baId,
    DIGEST_KEY,
  ));
  assert.equal(bosDigest, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.bos_realization_id_digest,
    bosId,
    DIGEST_KEY,
  ));
  assert.equal(fullPersonQaProfileDigest(fixture.profile_id.toUpperCase(), DIGEST_KEY), profileDigest);
  assert.equal(fullPersonQaAssessmentDigest(fixture.assessment_id.toUpperCase(), DIGEST_KEY), assessmentDigest);
  assert.notEqual(fullPersonQaProfileDigest(CASES[1].profile_id, DIGEST_KEY), profileDigest);
  assert.notEqual(fullPersonQaProfileDigest(fixture.profile_id, `${DIGEST_KEY}x`), profileDigest);
  assert.equal(new Set(Object.values(FULL_PERSON_QA_HMAC_DOMAINS)).size, 7);

  const sharedOpaqueId = 'synthetic-realization-id-shared-across-domain-check';
  assert.notEqual(
    fullPersonQaBaRealizationIdDigest(sharedOpaqueId, DIGEST_KEY),
    fullPersonQaBosRealizationIdDigest(sharedOpaqueId, DIGEST_KEY),
  );
  for (const [digest, rawId] of [
    [profileDigest, fixture.profile_id],
    [assessmentDigest, fixture.assessment_id],
    [baDigest, baId],
    [bosDigest, bosId],
  ]) {
    assert.equal(digest.includes(rawId), false);
  }

  throwsCode(
    () => fullPersonQaProfileDigest('mm-wildcard-*', DIGEST_KEY),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_ID_INVALID',
  );
  throwsCode(
    () => fullPersonQaAssessmentDigest('ba-placeholder', DIGEST_KEY),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_ASSESSMENT_ID_INVALID',
  );
  throwsCode(
    () => fullPersonQaBaRealizationIdDigest('new-ba:placeholder', DIGEST_KEY),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_BA_REALIZATION_ID_INVALID',
  );
  throwsCode(
    () => fullPersonQaBosRealizationIdDigest('short', DIGEST_KEY),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_BOS_REALIZATION_ID_INVALID',
  );
  throwsCode(
    () => fullPersonQaProfileDigest(fixture.profile_id, 'too-short'),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
  );
  for (const weakSecret of [
    'placeholder_digest_key_that_must_never_be_accepted',
    'x'.repeat(40),
    ` ${DIGEST_KEY}`,
  ]) {
    throwsCode(
      () => fullPersonQaProfileDigest(fixture.profile_id, weakSecret),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_DIGEST_KEY_REQUIRED',
    );
  }
  throwsCode(
    () => issueFullPersonQaCapability({
      profile_id: fixture.profile_id,
      manifest: manifest(),
      digest_key: DIGEST_KEY,
      signing_key: 'placeholder_signing_key_that_must_never_be_accepted',
      req: request(),
      now: NOW,
      token_factory: () => TOKEN,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_SIGNING_KEY_REQUIRED',
  );
});

test('manifest lookup returns the selected sealed row and grants only an active unexpired profile digest', () => {
  const entries = manifestEntries();
  const selected = entries[0];
  const active = resolveFullPersonQaManifestEntry({
    profile_id: CASES[0].profile_id,
    manifest: JSON.stringify(entries),
    digest_key: DIGEST_KEY,
    now: NOW,
  });

  for (const field of MANIFEST_KEYS) assert.equal(active[field], selected[field]);
  assert.equal(active.profile_id, CASES[0].profile_id);
  assert.equal(active.case_id, 'COHORT-V1-RE-A');
  assert.equal(active.vertical_id, 'real_estate');
  assert.equal(active.manifest_version, FULL_PERSON_QA_MANIFEST_VERSION);
  assert.match(active.manifest_sha256, /^[a-f0-9]{64}$/u);
  assert.equal(Object.isFrozen(active), true);

  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: 'mm-20260913-e5f6a7b8',
      manifest: manifest(),
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_NOT_ALLOWLISTED',
  );

  const oneRevoked = manifest((next) => {
    next[0].status = 'revoked';
    reseal(next[0]);
    return next;
  });
  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: CASES[0].profile_id,
      manifest: oneRevoked,
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_REVOKED',
  );
  assert.equal(resolveFullPersonQaManifestEntry({
    profile_id: CASES[1].profile_id,
    manifest: oneRevoked,
    digest_key: DIGEST_KEY,
    now: NOW,
  }).profile_id, CASES[1].profile_id);

  const oneExpired = manifest((next) => {
    next[0].expires_at = NOW.toISOString();
    reseal(next[0]);
    return next;
  });
  throwsCode(
    () => resolveFullPersonQaManifestEntry({
      profile_id: CASES[0].profile_id,
      manifest: oneExpired,
      digest_key: DIGEST_KEY,
      now: NOW,
    }),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_EXPIRED',
  );
});

test('issued capability signs and carries exactly the selected row custody behind an opaque cookie', () => {
  const entries = manifestEntries();
  const selected = entries[0];
  const issued = issue({ rawManifest: JSON.stringify(entries) });
  const { signature, ...claims } = issued.receipt;
  const expectedSignature = hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.receipt_signature,
    canonicalJson(claims),
    SIGNING_KEY,
  );

  assert.equal(signature, expectedSignature);
  assert.equal(issued.capability_hash, hmac(
    FULL_PERSON_QA_HMAC_DOMAINS.capability_token,
    TOKEN,
    SIGNING_KEY,
  ));
  assert.equal(issued.receipt.contract, FULL_PERSON_QA_CAPABILITY_CONTRACT);
  assert.equal(issued.receipt.case_id, selected.case_id);
  assert.equal(issued.receipt.authority_expires_at, selected.expires_at);
  assert.equal(Object.hasOwn(issued.receipt, 'authority_status'), false);
  for (const field of CUSTODY_HASH_FIELDS) assert.equal(issued.receipt[field], selected[field]);
  assert.equal(issued.receipt.custody_sha256, selected.custody_sha256);
  assert.equal(issued.receipt.vertical_id, selected.vertical_id);
  assert.equal(issued.max_age_seconds, FULL_PERSON_QA_CAPABILITY_TTL_SECONDS);
  assert.equal(
    issued.cookie,
    `${FULL_PERSON_QA_CAPABILITY_COOKIE}=${TOKEN}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${FULL_PERSON_QA_CAPABILITY_TTL_SECONDS}`,
  );
  assert.equal(issued.cookie.includes(CASES[0].profile_id), false);
  assert.equal(issued.cookie.includes(issued.receipt.custody_sha256), false);
  assert.equal(issued.cookie.includes(issued.receipt.authority_id), false);
  assert.equal(Object.hasOwn(issued, 'token'), false);
  assert.equal(Object.hasOwn(issued.receipt, 'token'), false);
  assert.equal(JSON.stringify(issued.receipt).includes(CASES[0].assessment_id), false);
  assert.equal(JSON.stringify(issued.receipt).includes(baRealizationId(CASES[0])), false);
  assert.equal(JSON.stringify(issued.receipt).includes(bosRealizationId(CASES[0])), false);
  assert.equal(issued.receipt.access_label, FULL_PERSON_QA_SYNTHETIC_LABEL);
  assert.equal(issued.receipt.synthetic_only, true);
  assert.equal(issued.receipt.billing_evidence, false);
  assert.equal(issued.receipt.stripe_subscription_created, false);
  assert.equal(Object.isFrozen(issued.receipt), true);
  assert.equal(
    clearFullPersonQaCapabilityCookie(),
    `${FULL_PERSON_QA_CAPABILITY_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
  assert.equal(fullPersonQaCapabilityCookiePresent(request(cookiePair(issued.cookie))), true);
  assert.equal(fullPersonQaCapabilityCookiePresent(request()), false);
  const oversizedSelected = request(`${'padding=x;'.repeat(2200)} ${cookiePair(issued.cookie)}`);
  assert.equal(fullPersonQaCapabilityCookiePresent(oversizedSelected), true);
  assert.equal(fullPersonQaCapabilityLookup({ req: oversizedSelected, signing_key: SIGNING_KEY }).ok, false);
});

test('capability verification requires the exact token, receipt, browser, signature, and time', () => {
  const rawManifest = manifest();
  const issued = issue({ rawManifest });
  const authenticatedRequest = request(cookiePair(issued.cookie));
  const verified = verify({
    issued,
    rawManifest,
    req: authenticatedRequest,
    now: new Date(NOW.getTime() + 60_000),
  });

  assert.equal(verified.ok, true);
  assert.equal(verified.capability.profile_id, CASES[0].profile_id);
  assert.equal(verified.capability.case_id, CASES[0].case_id);
  assert.equal(verified.capability.vertical_id, CASES[0].vertical_id);
  assert.equal(verified.capability.custody_sha256, issued.receipt.custody_sha256);
  assert.equal(verified.capability.allowed_product, 'subscription');
  assert.equal(verified.capability.access_class, 'SYNTHETIC_QA');
  assert.equal(verified.capability.authority_expires_at, EXPIRES);
  assert.equal(verified.capability.synthetic_only, true);
  assert.equal(verified.capability.billing_evidence, false);
  assert.equal(verified.capability.stripe_subscription_created, false);

  const lookup = fullPersonQaCapabilityLookup({
    req: authenticatedRequest,
    signing_key: SIGNING_KEY,
  });
  assert.deepEqual(lookup, { ok: true, capability_hash: issued.capability_hash });
  assert.equal(Object.hasOwn(lookup, 'token'), false);

  const missing = verifyFullPersonQaCapability({
    req: request(),
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(missing.code, 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_REQUIRED');

  const wrongToken = verifyFullPersonQaCapability({
    req: request(`${FULL_PERSON_QA_CAPABILITY_COOKIE}=${'B'.repeat(43)}`),
    receipt: issued.receipt,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(wrongToken.failure_class, 'CAPABILITY_TOKEN_MISMATCH');

  const duplicateCookie = fullPersonQaCapabilityLookup({
    req: request(`${cookiePair(issued.cookie)}; ${cookiePair(issued.cookie)}`),
    signing_key: SIGNING_KEY,
  });
  assert.equal(duplicateCookie.code, 'SUBSCRIPTION_V1_FULL_PERSON_QA_CAPABILITY_REQUIRED');

  const changedBrowser = verify({
    issued,
    rawManifest,
    req: request(cookiePair(issued.cookie), { address: '203.0.113.99' }),
  });
  assert.equal(changedBrowser.failure_class, 'CAPABILITY_BROWSER_BINDING_MISMATCH');

  const spoofedLegacyForward = request(cookiePair(issued.cookie));
  spoofedLegacyForward.headers['x-forwarded-for'] = '198.51.100.220';
  assert.equal(verify({ issued, rawManifest, req: spoofedLegacyForward }).ok, true);

  const badSignature = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: { ...issued.receipt, signature: 'f'.repeat(64) },
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(badSignature.failure_class, 'RECEIPT_SIGNATURE_MISMATCH');

  const extraReceiptField = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: { ...issued.receipt, debug: true },
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(extraReceiptField.failure_class, 'RECEIPT_MALFORMED');

  const malformedCustody = verifyFullPersonQaCapability({
    req: authenticatedRequest,
    receipt: { ...issued.receipt, custody_sha256: '0'.repeat(64) },
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(malformedCustody.failure_class, 'RECEIPT_MALFORMED');

  const expired = verify({
    issued,
    rawManifest,
    now: new Date(NOW.getTime() + FULL_PERSON_QA_CAPABILITY_TTL_SECONDS * 1000),
  });
  assert.equal(expired.failure_class, 'CAPABILITY_EXPIRED');
});

test('selected-row custody changes invalidate the receipt while unrelated valid row edits do not', () => {
  const rawManifest = manifest();
  const issued = issue({ rawManifest });
  const selectedHashChanges = Object.freeze([
    'assessment_digest',
    'assessment_evidence_sha256',
    'ba_artifact_sha256',
    'ba_envelope_sha256',
    'ba_realization_id_digest',
    'ba_realization_identity_sha256',
    'bos_artifact_sha256',
    'bos_canonical_source_sha256',
    'bos_envelope_sha256',
    'bos_realization_id_digest',
    'bos_realization_identity_sha256',
    'canonical_profile_artifact_sha256',
  ]);

  for (const field of selectedHashChanges) {
    const changedManifest = manifest((entries) => {
      entries[0][field] = sha256(`fake-selected-change:${field}`);
      reseal(entries[0]);
      return entries;
    });
    assert.equal(
      verify({ issued, rawManifest: changedManifest }).failure_class,
      'MANIFEST_AUTHORITY_MISMATCH',
      field,
    );
  }

  const changedAuthority = manifest((entries) => {
    entries[0].authority_id = `synthetic_qa_authority_${sha256('fake-replacement-authority').slice(0, 24)}`;
    reseal(entries[0]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: changedAuthority }).failure_class,
    'MANIFEST_AUTHORITY_MISMATCH',
  );

  const changedVerticalBinding = manifest((entries) => {
    const replacement = sha256('fake-replacement-real-estate-binding');
    entries[0].vertical_binding_sha256 = replacement;
    entries[1].vertical_binding_sha256 = replacement;
    reseal(entries[0]);
    reseal(entries[1]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: changedVerticalBinding }).failure_class,
    'MANIFEST_AUTHORITY_MISMATCH',
  );

  const changedCaseAndVertical = manifest((entries) => {
    const selectedCase = entries[0].case_id;
    const selectedVerticalAuthority = entries[0].vertical_authority_sha256;
    entries[0].case_id = entries[2].case_id;
    entries[0].vertical_id = entries[2].vertical_id;
    entries[0].vertical_authority_sha256 = entries[2].vertical_authority_sha256;
    entries[0].vertical_binding_sha256 = entries[2].vertical_binding_sha256;
    entries[2].case_id = selectedCase;
    entries[2].vertical_id = FULL_PERSON_QA_CASE_VERTICALS[selectedCase];
    entries[2].vertical_authority_sha256 = selectedVerticalAuthority;
    entries[2].vertical_binding_sha256 = manifestEntries()[0].vertical_binding_sha256;
    reseal(entries[0]);
    reseal(entries[2]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: changedCaseAndVertical }).failure_class,
    'MANIFEST_AUTHORITY_MISMATCH',
  );

  const changedExpiry = manifest((entries) => {
    entries[0].expires_at = '2026-10-01T00:00:00.000Z';
    reseal(entries[0]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: changedExpiry }).failure_class,
    'MANIFEST_AUTHORITY_MISMATCH',
  );

  const changedProfileDigest = manifest((entries) => {
    entries[0].profile_digest = sha256('fake-replacement-profile-digest');
    reseal(entries[0]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: changedProfileDigest }).failure_class,
    'MANIFEST_AUTHORITY_REVOKED',
  );

  const revokedSelected = manifest((entries) => {
    entries[0].status = 'revoked';
    reseal(entries[0]);
    return entries;
  });
  assert.equal(
    verify({ issued, rawManifest: revokedSelected }).failure_class,
    'MANIFEST_AUTHORITY_REVOKED',
  );

  const unrelatedChange = manifest((entries) => {
    entries[1].assessment_evidence_sha256 = sha256('fake-unrelated-evidence-change');
    reseal(entries[1]);
    return entries;
  });
  const unrelatedVerified = verify({ issued, rawManifest: unrelatedChange });
  assert.equal(unrelatedVerified.ok, true);
  assert.notEqual(unrelatedVerified.capability.manifest_sha256, issued.receipt.manifest_sha256);
  assert.equal(unrelatedVerified.capability.custody_sha256, issued.receipt.custody_sha256);

  const unrelatedRevocation = manifest((entries) => {
    entries[1].status = 'revoked';
    reseal(entries[1]);
    return entries;
  });
  assert.equal(verify({ issued, rawManifest: unrelatedRevocation }).ok, true);
});

test('even a self-consistent re-signed receipt cannot substitute different selected-row custody', () => {
  const rawManifest = manifest();
  const issued = issue({ rawManifest });
  const changed = {
    ...issued.receipt,
    bos_artifact_sha256: sha256('fake-substituted-bos-artifact'),
  };
  changed.custody_sha256 = fullPersonQaCustodySha256(receiptEntry(changed));
  const resigned = resignReceipt(changed);
  const result = verifyFullPersonQaCapability({
    req: request(cookiePair(issued.cookie)),
    receipt: resigned,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });

  assert.equal(result.failure_class, 'MANIFEST_AUTHORITY_MISMATCH');
});


test('reviewed subsets preserve complete custody and deny omitted or unknown identities', () => {
  const all = manifestEntries();
  for (const indexes of [[0], [2], [0, 1], [0, 2, 3], [0, 1, 2, 3]]) {
    const raw = JSON.stringify(indexes.map(index => all[index]));
    assert.equal(parseFullPersonQaManifest(raw).entries.length, indexes.length);
    for (let index = 0; index < CASES.length; index += 1) {
      const lookup = () => resolveFullPersonQaManifestEntry({ profile_id: CASES[index].profile_id,
        manifest: raw, digest_key: DIGEST_KEY, now: NOW });
      if (indexes.includes(index)) assert.equal(lookup().case_id, CASES[index].case_id);
      else throwsCode(lookup, 'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_NOT_ALLOWLISTED');
    }
  }
  for (const field of ['bos_artifact_sha256', 'ba_artifact_sha256']) {
    const row = { ...all[0] }; delete row[field];
    throwsCode(() => parseFullPersonQaManifest(JSON.stringify([row])),
      'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_FIELDS_INVALID');
  }
  const unknown = { ...all[0], case_id: 'COHORT-V1-RE-C' }; reseal(unknown);
  throwsCode(() => parseFullPersonQaManifest(JSON.stringify([unknown])),
    'SUBSCRIPTION_V1_FULL_PERSON_QA_MANIFEST_CASE_SET_INVALID');
});
