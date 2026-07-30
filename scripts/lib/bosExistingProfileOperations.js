import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { BuildProfileInput } from '../../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../../api/engine/normalizeAssessmentAnswers.js';
import { buildNarrativeV3 } from '../../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildUnifiedInterpretation } from '../../src/lib/narrativeV3/unifiedInterpreter.js';
import { buildCustomerBOSViewModel } from '../../src/lib/reports/buildCustomerBOSViewModel.js';

export const REGENERATION_CONFIRMATION = 'REGENERATE_EXISTING_BOS_PROFILE';
export const RESTORE_CONFIRMATION = 'RESTORE_EXISTING_BOS_PROFILE';

const PROFILE_ID_PATTERN = /^mm-\d{8}-[a-z0-9]{8}$/;
const TARGET_QUESTION_IDS = [6, 12, 13, 18];
const PRESERVED_CANONICAL_FIELDS = [
  'rescoring_gpt',
  'rescoring_gpt_metadata',
];

function fail(message, code = 'BOS_OPERATION_REJECTED') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizeProfileId(profileId) {
  const normalized = String(profileId || '').trim().toLowerCase();
  if (!PROFILE_ID_PATTERN.test(normalized)) {
    fail(`Invalid BOS profile ID: ${profileId || '(missing)'}`, 'INVALID_PROFILE_ID');
  }
  return normalized;
}

function assertProfileAuthority(profileId, confirmedProfileId) {
  const normalizedProfileId = normalizeProfileId(profileId);
  const normalizedConfirmation = normalizeProfileId(confirmedProfileId);

  if (normalizedProfileId !== normalizedConfirmation) {
    fail('Confirmed profile ID does not match requested profile ID', 'PROFILE_AUTHORITY_MISMATCH');
  }

  return normalizedProfileId;
}

function assertWriteAuthority({ dryRun, productionWrite, confirmation, expectedConfirmation }) {
  if (dryRun) {
    if (productionWrite) {
      fail('Dry-run and production-write cannot both be enabled', 'AMBIGUOUS_WRITE_MODE');
    }
    return;
  }

  if (!productionWrite) {
    fail('A non-dry-run operation requires --production-write', 'PRODUCTION_WRITE_REQUIRED');
  }

  if (confirmation !== expectedConfirmation) {
    fail('Explicit production confirmation is missing or incorrect', 'PRODUCTION_CONFIRMATION_REQUIRED');
  }
}

export function sha256(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

function generateProfileSignature(vectorScores) {
  const signatureInput = JSON.stringify(
    vectorScores || {},
    Object.keys(vectorScores || {}).sort(),
  );
  return createHash('sha256').update(signatureInput).digest('hex').substring(0, 16);
}

function generateSlug(value) {
  if (!value || typeof value !== 'string') return null;
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
}

export function requiredIndexKeys(record) {
  const keys = [];
  const createdAt = String(record?.created_at || '');
  const dateKey = /^\d{4}-\d{2}-\d{2}/.test(createdAt)
    ? createdAt.substring(0, 10)
    : null;
  const email = typeof record?.email === 'string'
    ? record.email.trim().toLowerCase()
    : null;
  const companySlug = record?.company_slug || generateSlug(record?.company_name);

  if (dateKey) keys.push(`vault:index:date:${dateKey}`);
  if (email) keys.push(`vault:index:email:${email}`);
  if (companySlug) keys.push(`vault:index:company:${companySlug}`);

  return keys;
}

function describeIndexKey(key) {
  const indexClass = key.startsWith('vault:index:date:')
    ? 'date'
    : key.startsWith('vault:index:email:')
      ? 'email'
      : key.startsWith('vault:index:company:')
        ? 'company'
        : 'unknown';
  return {
    index_class: indexClass,
    key_sha256_prefix: sha256(key).substring(0, 12),
  };
}

function answerChoice(answer) {
  if (!answer || typeof answer !== 'object') return null;
  return answer.answer_choice ?? answer.choice ?? answer.text ?? null;
}

export function summarizeBosRecord(record) {
  const canonical = record?.canonical_profile_json || {};
  const retainedAnswers = record?.intake_answers || {};
  const canonicalAnswers = canonical?.intake_answers || {};
  const canonicalKeys = Object.keys(canonicalAnswers);

  return {
    profile_id: record?.profile_id || null,
    retained_answer_count: Object.keys(retainedAnswers).length,
    canonical_answer_count: canonicalKeys.length,
    unique_canonical_answer_count: new Set(canonicalKeys).size,
    duplicate_canonical_answers: canonicalKeys.length - new Set(canonicalKeys).size,
    target_answers: Object.fromEntries(
      TARGET_QUESTION_IDS.map((id) => {
        const answer = canonicalAnswers[`q${id}`];
        return [
          `q${id}`,
          answer
            ? {
                question_type: answer.question_type || null,
                answer_choice: answerChoice(answer),
                answer_choices: Array.isArray(answer.answer_choices)
                  ? [...answer.answer_choices]
                  : null,
                normalized_dimension_count: Object.keys(answer.normalized_dimensions || {}).length,
              }
            : null,
        ];
      }),
    ),
    required_indexes: requiredIndexKeys(record).map(describeIndexKey),
  };
}

function assertExistingRecord(record, profileId, expectedRetainedCount) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    fail('Vault record is missing or malformed', 'INVALID_VAULT_RECORD');
  }

  if (normalizeProfileId(record.profile_id) !== profileId) {
    fail('Vault record profile ID does not match target', 'VAULT_PROFILE_ID_MISMATCH');
  }

  if (!record.intake_answers || typeof record.intake_answers !== 'object') {
    fail('Retained assessment answers are missing', 'RETAINED_ANSWERS_MISSING');
  }

  const retainedCount = Object.keys(record.intake_answers).length;
  if (retainedCount !== expectedRetainedCount) {
    fail(
      `Expected ${expectedRetainedCount} retained answers, found ${retainedCount}`,
      'RETAINED_ANSWER_COUNT_MISMATCH',
    );
  }
}

function assertExpectedChoices(summary, expectedAnswerChoices = {}) {
  for (const [qKey, expectedChoice] of Object.entries(expectedAnswerChoices)) {
    const actual = summary.target_answers[qKey]?.answer_choice;
    if (actual !== expectedChoice) {
      fail(
        `${qKey} expected answer_choice ${expectedChoice}, found ${actual || '(missing)'}`,
        'EXPECTED_CHOICE_MISMATCH',
      );
    }
  }
}

function assertRegeneratedSummary(summary, expectedCanonicalCount, expectedAnswerChoices) {
  if (summary.profile_id == null) {
    fail('Regenerated profile has no profile ID', 'REGENERATED_PROFILE_ID_MISSING');
  }

  if (summary.canonical_answer_count !== expectedCanonicalCount) {
    fail(
      `Expected ${expectedCanonicalCount} canonical answers, found ${summary.canonical_answer_count}`,
      'CANONICAL_ANSWER_COUNT_MISMATCH',
    );
  }

  if (summary.unique_canonical_answer_count !== expectedCanonicalCount) {
    fail('Canonical answers contain duplicate keys', 'DUPLICATE_CANONICAL_ANSWERS');
  }

  for (const id of TARGET_QUESTION_IDS) {
    if (!summary.target_answers[`q${id}`]) {
      fail(`Regenerated canonical is missing q${id}`, 'TARGET_CANONICAL_ANSWER_MISSING');
    }
  }

  assertExpectedChoices(summary, expectedAnswerChoices);
}

function preserveCanonicalCompatibilityFields(existingCanonical, regeneratedCanonical) {
  const result = {
    ...regeneratedCanonical,
    profile_id: existingCanonical.profile_id || regeneratedCanonical.profile_id,
    metadata: {
      ...(existingCanonical.metadata || {}),
      ...(regeneratedCanonical.metadata || {}),
      person_name:
        existingCanonical.metadata?.person_name
        ?? regeneratedCanonical.metadata?.person_name
        ?? null,
      email:
        existingCanonical.metadata?.email
        ?? regeneratedCanonical.metadata?.email
        ?? null,
      identity:
        existingCanonical.metadata?.identity
        ?? regeneratedCanonical.metadata?.identity
        ?? null,
      organization:
        existingCanonical.metadata?.organization
        ?? regeneratedCanonical.metadata?.organization
        ?? null,
      contextual_signals:
        existingCanonical.metadata?.contextual_signals
        ?? regeneratedCanonical.metadata?.contextual_signals
        ?? null,
    },
  };

  for (const field of PRESERVED_CANONICAL_FIELDS) {
    if (Object.hasOwn(existingCanonical, field)) {
      result[field] = existingCanonical[field];
    }
  }

  return result;
}

export async function verifyBosRenderer(record) {
  const canonical = record?.canonical_profile_json || {};
  const unified = buildUnifiedInterpretation(record);
  const narrative = await buildNarrativeV3(record, false, null, true);
  const viewModel = buildCustomerBOSViewModel({
    canonical: record,
    narrative,
    profileId: record.profile_id,
    personName: record.person_name,
    company: record.company_name,
    ranked: canonical.ranked_dimensions,
  });
  const serializedViewModel = JSON.stringify(viewModel);

  return {
    dominant_emotion: unified?.emotional_state?.primaryEmotion || null,
    emotional_intensity: unified?.emotional_state?.emotionalIntensity || null,
    narrative_v3_success: Boolean(narrative?.executiveSummary),
    customer_view_model_success: Boolean(viewModel?.customerSummary?.executive),
    tab_count: viewModel?.tabs?.length || 0,
    overview_section_count: viewModel?.overviewSections?.length || 0,
    executive_summary_populated: Boolean(viewModel?.customerSummary?.executive),
    one_move_populated: Boolean(viewModel?.oneMove?.content),
    render_failure_message: /Failed to render profile narrative/.test(serializedViewModel),
  };
}

function assertRendererProof(renderer) {
  if (
    !renderer.narrative_v3_success
    || !renderer.customer_view_model_success
    || renderer.tab_count !== 8
    || renderer.overview_section_count !== 5
    || !renderer.executive_summary_populated
    || !renderer.one_move_populated
    || renderer.render_failure_message
  ) {
    fail('Regenerated profile failed customer renderer verification', 'RENDERER_VERIFICATION_FAILED');
  }
}

export async function prepareExistingBosRegeneration({
  profileId,
  existingRecord,
  expectedRetainedCount,
  expectedCanonicalCount = expectedRetainedCount,
  expectedAnswerChoices = {},
  canonicalGenerator = generateCanonicalProfile,
}) {
  const normalizedProfileId = normalizeProfileId(profileId);
  assertExistingRecord(existingRecord, normalizedProfileId, expectedRetainedCount);

  const retainedAnswers = existingRecord.intake_answers;
  const normalizedAnswers = normalizeAssessmentAnswers(retainedAnswers);
  const profileInput = new BuildProfileInput().build({ answers: normalizedAnswers });
  const profileInputAnswerCount = Object.keys(profileInput.raw_answers || {}).length;

  if (profileInputAnswerCount !== expectedCanonicalCount) {
    fail(
      `Profile input contains ${profileInputAnswerCount} answers; expected ${expectedCanonicalCount}`,
      'PROFILE_INPUT_ANSWER_COUNT_MISMATCH',
    );
  }

  const existingCanonical = existingRecord.canonical_profile_json || {};
  const generatedCanonical = await canonicalGenerator(profileInput, {
    profile_id: normalizedProfileId,
    model: existingCanonical.metadata?.model || existingRecord.model || 'canonical-v2-frontier-restored',
  });

  if (normalizeProfileId(generatedCanonical.profile_id) !== normalizedProfileId) {
    fail('Canonical generator changed the existing profile ID', 'CANONICAL_PROFILE_ID_CHANGED');
  }

  const canonicalProfile = preserveCanonicalCompatibilityFields(
    existingCanonical,
    generatedCanonical,
  );
  canonicalProfile.profile_id = normalizedProfileId;

  const regeneratedRecord = {
    ...existingRecord,
    profile_id: normalizedProfileId,
    canonical_profile_json: canonicalProfile,
    vector_scores: canonicalProfile.vector_scores || {},
    profile_signature: generateProfileSignature(canonicalProfile.vector_scores || {}),
    intake_answers: retainedAnswers,
  };

  const summary = summarizeBosRecord(regeneratedRecord);
  assertRegeneratedSummary(summary, expectedCanonicalCount, expectedAnswerChoices);
  const renderer = await verifyBosRenderer(regeneratedRecord);
  assertRendererProof(renderer);

  return {
    profile_id: normalizedProfileId,
    record: regeneratedRecord,
    raw: JSON.stringify(regeneratedRecord),
    summary,
    renderer,
  };
}

async function createAndVerifyBackup({ backupWriter, profileId, raw }) {
  if (!backupWriter) {
    fail('A verified backup writer is required before production writes', 'BACKUP_WRITER_REQUIRED');
  }

  const expectedSha256 = sha256(raw);
  const result = await backupWriter({ profileId, raw, expectedSha256 });

  if (!result || result.sha256 !== expectedSha256) {
    fail('Backup SHA-256 verification failed', 'BACKUP_HASH_MISMATCH');
  }

  return {
    ...result,
    sha256: expectedSha256,
  };
}

async function verifyStoredRegeneration({
  storage,
  profileId,
  expectedCanonicalCount,
  expectedAnswerChoices,
}) {
  const stored = await storage.readProfile(profileId);
  if (!stored) {
    fail('Profile retrieval failed after regeneration', 'POST_WRITE_RETRIEVAL_FAILED');
  }

  if (normalizeProfileId(stored.record.profile_id) !== profileId) {
    fail('Stored profile ID changed after regeneration', 'POST_WRITE_PROFILE_ID_CHANGED');
  }

  const summary = summarizeBosRecord(stored.record);
  assertRegeneratedSummary(summary, expectedCanonicalCount, expectedAnswerChoices);
  const indexes = await storage.verifyIndexes(stored.record);
  if (!indexes.ok) {
    fail('Required profile indexes failed verification', 'INDEX_VERIFICATION_FAILED');
  }
  const renderer = await verifyBosRenderer(stored.record);
  assertRendererProof(renderer);

  return {
    stored,
    summary,
    indexes,
    renderer,
  };
}

export async function restoreExistingBosProfile({
  profileId,
  confirmedProfileId,
  backupRaw,
  expectedBackupSha256,
  dryRun = true,
  productionWrite = false,
  confirmation = null,
  storage,
}) {
  const normalizedProfileId = assertProfileAuthority(profileId, confirmedProfileId);
  assertWriteAuthority({
    dryRun,
    productionWrite,
    confirmation,
    expectedConfirmation: RESTORE_CONFIRMATION,
  });

  if (!storage) {
    fail('Storage adapter is required', 'STORAGE_ADAPTER_REQUIRED');
  }

  if (sha256(backupRaw) !== expectedBackupSha256) {
    fail('Backup SHA-256 does not match expected value', 'BACKUP_HASH_MISMATCH');
  }

  let backupRecord;
  try {
    backupRecord = JSON.parse(backupRaw);
  } catch {
    fail('Backup JSON is malformed', 'BACKUP_JSON_INVALID');
  }

  if (normalizeProfileId(backupRecord.profile_id) !== normalizedProfileId) {
    fail('Backup profile ID does not match restore target', 'BACKUP_PROFILE_ID_MISMATCH');
  }

  if (!backupRecord.canonical_profile_json || !backupRecord.intake_answers) {
    fail('Backup does not contain a complete Vault record', 'BACKUP_SCHEMA_INVALID');
  }

  const existing = await storage.readProfile(normalizedProfileId);
  if (!existing) {
    fail('Restore target does not exist', 'RESTORE_TARGET_NOT_FOUND');
  }

  const receipt = {
    operation: 'restore_existing_bos_profile',
    mode: dryRun ? 'dry_run' : 'production_write',
    profile_id: normalizedProfileId,
    backup_sha256: expectedBackupSha256,
    backup_bytes: Buffer.byteLength(backupRaw, 'utf8'),
    restored: false,
  };

  if (dryRun) {
    return {
      ...receipt,
      proposed_summary: summarizeBosRecord(backupRecord),
    };
  }

  await storage.writeProfileRaw({
    profileId: normalizedProfileId,
    key: existing.key,
    raw: backupRaw,
  });
  const indexes = await storage.ensureIndexes(backupRecord);
  const verified = await storage.readProfile(normalizedProfileId);

  if (!verified || verified.raw !== backupRaw) {
    fail('Restored Vault bytes do not match backup bytes', 'RESTORE_BYTE_VERIFICATION_FAILED');
  }

  const indexVerification = await storage.verifyIndexes(verified.record);
  if (!indexVerification.ok) {
    fail('Restored profile indexes failed verification', 'RESTORE_INDEX_VERIFICATION_FAILED');
  }

  return {
    ...receipt,
    restored: true,
    restored_bytes_match: true,
    restored_summary: summarizeBosRecord(verified.record),
    indexes,
    index_verification: indexVerification,
  };
}

export async function regenerateExistingBosProfile({
  profileId,
  confirmedProfileId,
  expectedRetainedCount,
  expectedCanonicalCount = expectedRetainedCount,
  expectedAnswerChoices = {},
  dryRun = true,
  productionWrite = false,
  confirmation = null,
  storage,
  backupWriter = null,
  postWriteVerifier = null,
}) {
  const normalizedProfileId = assertProfileAuthority(profileId, confirmedProfileId);
  assertWriteAuthority({
    dryRun,
    productionWrite,
    confirmation,
    expectedConfirmation: REGENERATION_CONFIRMATION,
  });

  if (!Number.isInteger(expectedRetainedCount) || expectedRetainedCount <= 0) {
    fail('Expected retained-answer count must be a positive integer', 'INVALID_EXPECTED_COUNT');
  }

  if (!storage) {
    fail('Storage adapter is required', 'STORAGE_ADAPTER_REQUIRED');
  }

  const existing = await storage.readProfile(normalizedProfileId);
  if (!existing) {
    fail('Target profile does not exist', 'PROFILE_NOT_FOUND');
  }
  const preWriteIndexes = await storage.verifyIndexes(existing.record);
  if (!preWriteIndexes.ok) {
    fail('Required pre-regeneration indexes failed verification', 'PRE_WRITE_INDEX_VERIFICATION_FAILED');
  }

  const prepared = await prepareExistingBosRegeneration({
    profileId: normalizedProfileId,
    existingRecord: existing.record,
    expectedRetainedCount,
    expectedCanonicalCount,
    expectedAnswerChoices,
  });
  const preSummary = summarizeBosRecord(existing.record);
  const backup = backupWriter
    ? await createAndVerifyBackup({
        backupWriter,
        profileId: normalizedProfileId,
        raw: existing.raw,
      })
    : null;

  const baseReceipt = {
    operation: 'regenerate_existing_bos_profile',
    mode: dryRun ? 'dry_run' : 'production_write',
    profile_id: normalizedProfileId,
    storage_key: existing.key,
    pre_regeneration: preSummary,
    pre_write_index_verification: preWriteIndexes,
    proposed: prepared.summary,
    renderer: prepared.renderer,
    backup,
    written: false,
  };

  if (dryRun) {
    return baseReceipt;
  }

  if (!backup) {
    fail('A verified backup is required before production writes', 'BACKUP_REQUIRED');
  }

  try {
    await storage.writeProfileRaw({
      profileId: normalizedProfileId,
      key: existing.key,
      raw: prepared.raw,
    });
    const indexes = await storage.ensureIndexes(prepared.record);
    const verification = await verifyStoredRegeneration({
      storage,
      profileId: normalizedProfileId,
      expectedCanonicalCount,
      expectedAnswerChoices,
    });

    if (postWriteVerifier) {
      await postWriteVerifier(verification);
    }

    return {
      ...baseReceipt,
      written: true,
      backup,
      post_write: {
        summary: verification.summary,
        indexes,
        index_verification: verification.indexes,
        renderer: verification.renderer,
      },
    };
  } catch (writeOrVerificationError) {
    let restoreReceipt = null;
    try {
      restoreReceipt = await restoreExistingBosProfile({
        profileId: normalizedProfileId,
        confirmedProfileId: normalizedProfileId,
        backupRaw: existing.raw,
        expectedBackupSha256: backup.sha256,
        dryRun: false,
        productionWrite: true,
        confirmation: RESTORE_CONFIRMATION,
        storage,
      });
    } catch (restoreError) {
      const aggregate = new Error(
        `Regeneration failed and automatic restore failed: ${writeOrVerificationError.message}; restore: ${restoreError.message}`,
      );
      aggregate.code = 'REGENERATION_AND_RESTORE_FAILED';
      aggregate.regeneration_error = writeOrVerificationError;
      aggregate.restore_error = restoreError;
      throw aggregate;
    }

    const error = new Error(
      `Regeneration failed after write; prior profile restored: ${writeOrVerificationError.message}`,
    );
    error.code = 'REGENERATION_FAILED_PROFILE_RESTORED';
    error.restore_receipt = restoreReceipt;
    throw error;
  }
}

export function createRedisBosProfileStorage(redis) {
  if (!redis) {
    fail('Redis client is required', 'REDIS_CLIENT_REQUIRED');
  }

  function exactKeys(profileId) {
    const normalized = normalizeProfileId(profileId);
    const [, datePart, randomPart] = normalized.split('-');
    return [
      `vault:profile:${normalized}`,
      `vault:profile:MM-${datePart}-${randomPart}`,
    ];
  }

  return {
    async readProfile(profileId) {
      for (const key of exactKeys(profileId)) {
        const raw = await redis.get(key);
        if (raw != null) {
          let record;
          try {
            record = JSON.parse(raw);
          } catch {
            fail(`Stored Vault JSON is malformed at ${key}`, 'STORED_JSON_INVALID');
          }
          return { key, raw, record };
        }
      }
      return null;
    },

    async writeProfileRaw({ profileId, key, raw }) {
      const allowedKeys = exactKeys(profileId);
      if (!allowedKeys.includes(key)) {
        fail('Storage write key is outside the exact target profile', 'STORAGE_KEY_SCOPE_VIOLATION');
      }
      const parsed = JSON.parse(raw);
      if (normalizeProfileId(parsed.profile_id) !== normalizeProfileId(profileId)) {
        fail('Storage payload profile ID does not match write target', 'STORAGE_PAYLOAD_SCOPE_VIOLATION');
      }

      await redis.set(key, raw);
      const verified = await redis.get(key);
      if (verified !== raw) {
        fail('Vault SET verification failed', 'VAULT_SET_VERIFICATION_FAILED');
      }
      return {
        key,
        bytes: Buffer.byteLength(raw, 'utf8'),
        content_match: true,
      };
    },

    async ensureIndexes(record) {
      const profileId = normalizeProfileId(record.profile_id);
      const keys = requiredIndexKeys(record);
      for (const key of keys) {
        await redis.sadd(key, profileId);
      }
      return {
        profile_id: profileId,
        indexes: keys.map(describeIndexKey),
        ensured: keys.length,
      };
    },

    async verifyIndexes(record) {
      const profileId = normalizeProfileId(record.profile_id);
      const keys = requiredIndexKeys(record);
      const results = [];
      for (const key of keys) {
        const member = await redis.sismember(key, profileId);
        results.push({ ...describeIndexKey(key), member: member === 1 });
      }
      return {
        ok: results.every((result) => result.member),
        profile_id: profileId,
        results,
      };
    },
  };
}
