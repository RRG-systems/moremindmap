import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import { BuildProfileInput } from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import { QUESTION_MAP } from '../api/engine/questionMap.js';
import {
  REGENERATION_CONFIRMATION,
  RESTORE_CONFIRMATION,
  regenerateExistingBosProfile,
  requiredIndexKeys,
  restoreExistingBosProfile,
  sha256,
} from '../scripts/lib/bosExistingProfileOperations.js';

const PROFILE_ID = 'mm-20260730-synth001';
const OTHER_PROFILE_ID = 'mm-20260730-synth002';
const TARGET_CHOICES = {
  q6: '3,2,4,1',
  q12: '3,2,4,1',
  q13: 'D,C',
  q18: '2,4,3,1',
};
const TARGET_ARRAYS = {
  q6: ['3', '2', '4', '1'],
  q12: ['3', '2', '4', '1'],
  q13: ['D', 'C'],
  q18: ['2', '4', '3', '1'],
};

function completeUiAnswers() {
  const targetById = {
    6: TARGET_ARRAYS.q6,
    12: TARGET_ARRAYS.q12,
    13: TARGET_ARRAYS.q13,
    18: TARGET_ARRAYS.q18,
  };
  const written = 'Faith, family, service, disciplined routines, and useful work shape the next chapter.';

  return Object.fromEntries(
    QUESTION_MAP.set_1.v1.map((question) => [
      question.id,
      question.type === 'written'
        ? written
        : targetById[question.id] || question.answers[0].key,
    ]),
  );
}

async function syntheticRecord(profileId = PROFILE_ID) {
  const normalized = normalizeAssessmentAnswers(completeUiAnswers());
  const retainedAnswers = {
    ...normalized,
    q6: { text: TARGET_CHOICES.q6 },
    q12: { text: TARGET_CHOICES.q12 },
    q13: { text: TARGET_CHOICES.q13 },
    q18: { text: TARGET_CHOICES.q18 },
  };
  const profileInput = new BuildProfileInput().build({ answers: retainedAnswers });
  const canonical = await generateCanonicalProfile(profileInput, {
    profile_id: profileId,
    model: 'synthetic-test-model',
  });
  canonical.rescoring_gpt = {
    version: 'synthetic-preserved-layer',
    ranked_dimensions: canonical.ranked_dimensions,
  };

  for (const qKey of Object.keys(TARGET_CHOICES)) {
    delete canonical.intake_answers[qKey];
  }

  return {
    profile_id: profileId,
    job_id: 'synthetic-job',
    person_name: 'Sanitized Synthetic Subject',
    email: 'synthetic@example.invalid',
    company_name: 'Sanitized Synthetic Company',
    company_slug: 'sanitized-synthetic-company',
    created_at: '2026-07-30T00:00:00.000Z',
    assessment_version: 'mini-v2',
    model: 'synthetic-test-model',
    canonical_profile_json: canonical,
    vector_scores: canonical.vector_scores,
    profile_signature: 'synthetic-prior-signature',
    intake_answers: retainedAnswers,
    metadata: {
      saved_by: 'synthetic-test',
      vault_version: '1.0.0',
    },
  };
}

class MemoryProfileStorage {
  constructor(records, events = []) {
    this.events = events;
    this.records = new Map(
      records.map((record) => [
        record.profile_id,
        {
          key: `vault:profile:${record.profile_id}`,
          raw: JSON.stringify(record),
        },
      ]),
    );
    this.indexes = new Map();
    for (const record of records) this.seedIndexes(record);
  }

  seedIndexes(record) {
    for (const key of requiredIndexKeys(record)) {
      if (!this.indexes.has(key)) this.indexes.set(key, new Set());
      this.indexes.get(key).add(record.profile_id);
    }
  }

  async readProfile(profileId) {
    const stored = this.records.get(profileId);
    if (!stored) return null;
    return {
      key: stored.key,
      raw: stored.raw,
      record: JSON.parse(stored.raw),
    };
  }

  async writeProfileRaw({ profileId, key, raw }) {
    assert.equal(key, `vault:profile:${profileId}`);
    assert.equal(JSON.parse(raw).profile_id, profileId);
    this.events.push({ type: 'write', profile_id: profileId });
    this.records.set(profileId, { key, raw });
    return { key, bytes: Buffer.byteLength(raw), content_match: true };
  }

  async ensureIndexes(record) {
    this.events.push({ type: 'ensure_indexes', profile_id: record.profile_id });
    this.seedIndexes(record);
    return {
      profile_id: record.profile_id,
      ensured: requiredIndexKeys(record).length,
    };
  }

  async verifyIndexes(record) {
    const results = requiredIndexKeys(record).map((key) => ({
      key,
      member: this.indexes.get(key)?.has(record.profile_id) || false,
    }));
    return {
      ok: results.every((result) => result.member),
      profile_id: record.profile_id,
      results,
    };
  }
}

function verifiedBackupWriter(events, { badHash = false } = {}) {
  return async ({ profileId, raw, expectedSha256 }) => {
    events.push({ type: 'backup', profile_id: profileId, raw });
    return {
      path: `/synthetic/${profileId}.json`,
      sha256: badHash ? 'bad-hash' : expectedSha256,
      bytes: Buffer.byteLength(raw),
      status: 'created',
    };
  };
}

async function fixture() {
  const primary = await syntheticRecord(PROFILE_ID);
  const other = await syntheticRecord(OTHER_PROFILE_ID);
  const events = [];
  const storage = new MemoryProfileStorage([primary, other], events);
  return {
    primary,
    other,
    events,
    storage,
    primaryRaw: JSON.stringify(primary),
    otherRaw: JSON.stringify(other),
  };
}

function regenerationOptions(context, overrides = {}) {
  return {
    profileId: PROFILE_ID,
    confirmedProfileId: PROFILE_ID,
    expectedRetainedCount: 28,
    expectedCanonicalCount: 28,
    expectedAnswerChoices: TARGET_CHOICES,
    dryRun: true,
    productionWrite: false,
    storage: context.storage,
    backupWriter: verifiedBackupWriter(context.events),
    ...overrides,
  };
}

async function productionRegeneration(context, overrides = {}) {
  return regenerateExistingBosProfile(regenerationOptions(context, {
    dryRun: false,
    productionWrite: true,
    confirmation: REGENERATION_CONFIRMATION,
    ...overrides,
  }));
}

test('dry-run creates a verified backup but does not write', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  assert.equal(receipt.mode, 'dry_run');
  assert.equal(receipt.written, false);
  assert.equal(context.events.filter(({ type }) => type === 'backup').length, 1);
  assert.equal(context.events.filter(({ type }) => type === 'write').length, 0);
  assert.equal((await context.storage.readProfile(PROFILE_ID)).raw, context.primaryRaw);
});

test('same profile ID is retained in the proposed canonical and Vault record', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  assert.equal(receipt.profile_id, PROFILE_ID);
  assert.equal(receipt.proposed.profile_id, PROFILE_ID);
});

test('identity ownership and legacy rescoring remain preserved', async () => {
  const context = await fixture();
  await productionRegeneration(context);
  const stored = (await context.storage.readProfile(PROFILE_ID)).record;

  assert.equal(stored.person_name, context.primary.person_name);
  assert.equal(stored.email, context.primary.email);
  assert.equal(stored.company_name, context.primary.company_name);
  assert.deepEqual(
    stored.canonical_profile_json.rescoring_gpt,
    context.primary.canonical_profile_json.rescoring_gpt,
  );
});

test('regeneration never creates a new profile ID or storage key', async () => {
  const context = await fixture();
  const beforeKeys = [...context.storage.records.keys()];
  await productionRegeneration(context);

  assert.deepEqual([...context.storage.records.keys()], beforeKeys);
  assert.equal(context.events.filter(({ type }) => type === 'write').length, 1);
  assert.equal(context.events.find(({ type }) => type === 'write').profile_id, PROFILE_ID);
});

test('28 retained answers become exactly 28 canonical answers', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  assert.equal(receipt.proposed.retained_answer_count, 28);
  assert.equal(receipt.proposed.canonical_answer_count, 28);
  assert.equal(receipt.proposed.unique_canonical_answer_count, 28);
});

test('Q6 Q12 Q13 and Q18 are restored with expected choices', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  for (const [qKey, choice] of Object.entries(TARGET_CHOICES)) {
    assert.equal(receipt.proposed.target_answers[qKey].answer_choice, choice);
  }
});

test('ranking order is preserved exactly', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  assert.deepEqual(receipt.proposed.target_answers.q6.answer_choices, TARGET_ARRAYS.q6);
  assert.deepEqual(receipt.proposed.target_answers.q12.answer_choices, TARGET_ARRAYS.q12);
  assert.deepEqual(receipt.proposed.target_answers.q18.answer_choices, TARGET_ARRAYS.q18);
});

test('Q13 remains choose_two and both selections contribute once', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));
  const q13 = receipt.proposed.target_answers.q13;

  assert.equal(q13.question_type, 'choose_two');
  assert.deepEqual(q13.answer_choices, ['D', 'C']);
  assert.equal(q13.normalized_dimension_count, 5);
});

test('duplicate canonical answers remain zero', async () => {
  const context = await fixture();
  const receipt = await regenerateExistingBosProfile(regenerationOptions(context));

  assert.equal(receipt.proposed.duplicate_canonical_answers, 0);
});

test('missing retained answers block regeneration', async () => {
  const context = await fixture();
  const stored = await context.storage.readProfile(PROFILE_ID);
  delete stored.record.intake_answers.q28;
  context.storage.records.get(PROFILE_ID).raw = JSON.stringify(stored.record);

  await assert.rejects(
    regenerateExistingBosProfile(regenerationOptions(context)),
    { code: 'RETAINED_ANSWER_COUNT_MISMATCH' },
  );
  assert.equal(context.events.filter(({ type }) => type === 'write').length, 0);
});

test('an unexpected retained-answer expectation blocks regeneration', async () => {
  const context = await fixture();

  await assert.rejects(
    regenerateExistingBosProfile(regenerationOptions(context, {
      expectedRetainedCount: 27,
      expectedCanonicalCount: 27,
    })),
    { code: 'RETAINED_ANSWER_COUNT_MISMATCH' },
  );
});

test('a wrong confirmed profile ID blocks regeneration', async () => {
  const context = await fixture();

  await assert.rejects(
    regenerateExistingBosProfile(regenerationOptions(context, {
      confirmedProfileId: OTHER_PROFILE_ID,
    })),
    { code: 'PROFILE_AUTHORITY_MISMATCH' },
  );
  assert.equal(context.events.length, 0);
});

test('an unknown profile ID blocks regeneration', async () => {
  const context = await fixture();
  const unknownId = 'mm-20260730-unknown1';

  await assert.rejects(
    regenerateExistingBosProfile(regenerationOptions(context, {
      profileId: unknownId,
      confirmedProfileId: unknownId,
    })),
    { code: 'PROFILE_NOT_FOUND' },
  );
});

test('missing production confirmation blocks writes', async () => {
  const context = await fixture();

  await assert.rejects(
    regenerateExistingBosProfile(regenerationOptions(context, {
      dryRun: false,
      productionWrite: true,
      confirmation: null,
    })),
    { code: 'PRODUCTION_CONFIRMATION_REQUIRED' },
  );
  assert.equal(context.events.length, 0);
});

test('backup is created and hash-verified before the first write', async () => {
  const context = await fixture();
  const receipt = await productionRegeneration(context);

  assert.equal(context.events[0].type, 'backup');
  assert.equal(context.events[1].type, 'write');
  assert.equal(receipt.backup.sha256, sha256(context.primaryRaw));
});

test('a bad backup hash blocks the production write', async () => {
  const context = await fixture();

  await assert.rejects(
    productionRegeneration(context, {
      backupWriter: verifiedBackupWriter(context.events, { badHash: true }),
    }),
    { code: 'BACKUP_HASH_MISMATCH' },
  );
  assert.equal(context.events.filter(({ type }) => type === 'write').length, 0);
});

test('restore returns the exact prior Vault bytes and canonical state', async () => {
  const context = await fixture();
  await productionRegeneration(context);
  assert.notEqual((await context.storage.readProfile(PROFILE_ID)).raw, context.primaryRaw);

  const receipt = await restoreExistingBosProfile({
    profileId: PROFILE_ID,
    confirmedProfileId: PROFILE_ID,
    backupRaw: context.primaryRaw,
    expectedBackupSha256: sha256(context.primaryRaw),
    dryRun: false,
    productionWrite: true,
    confirmation: RESTORE_CONFIRMATION,
    storage: context.storage,
  });

  assert.equal(receipt.restored, true);
  assert.equal(receipt.restored_bytes_match, true);
  assert.equal((await context.storage.readProfile(PROFILE_ID)).raw, context.primaryRaw);
  assert.equal(receipt.restored_summary.canonical_answer_count, 24);
});

test('required date email and company indexes remain intact', async () => {
  const context = await fixture();
  const receipt = await productionRegeneration(context);

  assert.equal(receipt.post_write.index_verification.ok, true);
  assert.equal(receipt.post_write.index_verification.results.length, 3);
  assert.ok(receipt.post_write.index_verification.results.every(({ member }) => member));
});

test('a simulated failed post-write verification triggers exact restore', async () => {
  const context = await fixture();

  await assert.rejects(
    productionRegeneration(context, {
      postWriteVerifier: async () => {
        throw new Error('synthetic post-write verification failure');
      },
    }),
    { code: 'REGENERATION_FAILED_PROFILE_RESTORED' },
  );

  assert.equal((await context.storage.readProfile(PROFILE_ID)).raw, context.primaryRaw);
  assert.equal(context.events.filter(({ type }) => type === 'write').length, 2);
});

test('no other profile can be modified by a scoped regeneration', async () => {
  const context = await fixture();
  await productionRegeneration(context);

  assert.equal((await context.storage.readProfile(OTHER_PROFILE_ID)).raw, context.otherRaw);
  assert.equal(
    context.events.filter(({ type, profile_id }) =>
      type === 'write' && profile_id === OTHER_PROFILE_ID
    ).length,
    0,
  );
});

test('synthetic 24 to 28 render to exact restore cycle completes', async () => {
  const context = await fixture();
  assert.equal(
    Object.keys(context.primary.canonical_profile_json.intake_answers).length,
    24,
  );

  const regeneration = await productionRegeneration(context);
  assert.equal(regeneration.post_write.summary.canonical_answer_count, 28);
  assert.equal(regeneration.post_write.renderer.narrative_v3_success, true);
  assert.equal(regeneration.post_write.renderer.tab_count, 8);
  assert.equal(regeneration.post_write.renderer.overview_section_count, 5);

  await restoreExistingBosProfile({
    profileId: PROFILE_ID,
    confirmedProfileId: PROFILE_ID,
    backupRaw: context.primaryRaw,
    expectedBackupSha256: sha256(context.primaryRaw),
    dryRun: false,
    productionWrite: true,
    confirmation: RESTORE_CONFIRMATION,
    storage: context.storage,
  });

  const restored = await context.storage.readProfile(PROFILE_ID);
  assert.equal(restored.raw, context.primaryRaw);
  assert.equal(
    Object.keys(restored.record.canonical_profile_json.intake_answers).length,
    24,
  );
});
