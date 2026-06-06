/**
 * POST /api/diagnostic/seed-synthetic-profile
 *
 * Temporary authenticated QA-only endpoint for seeding a narrowly scoped
 * synthetic solo real estate agent profile from an existing behavioral pattern.
 */

import Redis from 'ioredis';
import { saveCanonicalProfile } from '../engine/vault/saveCanonicalProfile.js';
import { isValidProfileId } from '../engine/vault/generateProfileId.js';

const ALLOWED_SOURCE_PROFILE_ID = 'mm-20260531-asovnjz4';
const TARGET_PROFILE_PATTERN = /^mm-\d{8}-qasolo\d{2}$/;
const REQUIRED_FIXTURE_TYPE = 'real_estate_solo_agent';
const REQUIRED_SOURCE_PATTERN = 'wally_like';

function getAuthSecret() {
  return process.env.QA_SEED_SECRET || process.env.ADMIN_GPT_RESCORE_SECRET || null;
}

function getBearer(req) {
  return req.headers.authorization?.replace(/^Bearer\s+/i, '') || null;
}

function getRedis() {
  if (!process.env.REDIS_URL) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(process.env.REDIS_URL);
}

function normalizeProfileId(profileId) {
  return typeof profileId === 'string' ? profileId.trim().toLowerCase() : '';
}

function assertSeedPayload(body) {
  const sourceProfileId = normalizeProfileId(body?.source_profile_id);
  const targetProfileId = normalizeProfileId(body?.target_profile_id);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (sourceProfileId !== ALLOWED_SOURCE_PROFILE_ID) {
    return { ok: false, error: 'invalid_source_profile_id' };
  }

  if (!isValidProfileId(targetProfileId) || !TARGET_PROFILE_PATTERN.test(targetProfileId)) {
    return { ok: false, error: 'invalid_synthetic_profile_id' };
  }

  if (!name || name.length > 120) {
    return { ok: false, error: 'invalid_synthetic_name' };
  }

  if (!email || !email.endsWith('@example.invalid')) {
    return { ok: false, error: 'invalid_synthetic_email' };
  }

  if (
    body?.qa_fixture !== true ||
    body?.synthetic !== true ||
    body?.do_not_use_for_real_customer !== true ||
    body?.fixture_type !== REQUIRED_FIXTURE_TYPE ||
    body?.source_behavior_pattern !== REQUIRED_SOURCE_PATTERN
  ) {
    return { ok: false, error: 'missing_required_synthetic_flags' };
  }

  return {
    ok: true,
    sourceProfileId,
    targetProfileId,
    name,
    email,
  };
}

async function readVaultRecord(redis, profileId) {
  const normalized = normalizeProfileId(profileId);
  const [, datePart, randomPart] = normalized.match(/^mm-(\d{8})-([a-z0-9]{8})$/) || [];
  if (!datePart || !randomPart) return { record: null, key: null };

  const keyAttempts = [
    `vault:profile:mm-${datePart}-${randomPart}`,
    `vault:profile:MM-${datePart}-${randomPart}`,
  ];

  for (const key of keyAttempts) {
    const raw = await redis.get(key);
    if (raw) {
      return { record: JSON.parse(raw), key };
    }
  }

  return { record: null, key: null };
}

function setIfObject(target, values) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return;
  Object.assign(target, values);
}

function replaceAnswerText(answers, key, value) {
  if (!answers || typeof answers !== 'object' || !answers[key]) return;

  if (typeof answers[key] === 'string') {
    answers[key] = value;
    return;
  }

  if (typeof answers[key] === 'object') {
    if ('answer_text' in answers[key]) answers[key].answer_text = value;
    if ('value' in answers[key]) answers[key].value = value;
    if ('answer' in answers[key]) answers[key].answer = value;
  }
}

function buildSyntheticCanonicalProfile(sourceRecord, payload) {
  const sourceCanonical = sourceRecord?.canonical_profile_json;
  if (!sourceCanonical || typeof sourceCanonical !== 'object') {
    throw new Error('source_canonical_profile_missing');
  }

  const canonical = structuredClone(sourceCanonical);
  const metadata = {
    qa_fixture: true,
    synthetic: true,
    fixture_type: REQUIRED_FIXTURE_TYPE,
    source_behavior_pattern: REQUIRED_SOURCE_PATTERN,
    source_profile_id: payload.sourceProfileId,
    do_not_use_for_real_customer: true,
  };

  setIfObject(canonical, {
    profile_id: payload.targetProfileId,
    person_name: payload.name,
    full_name: payload.name,
    name: payload.name,
    email: payload.email,
  });

  setIfObject(canonical.metadata, {
    ...metadata,
    profile_id: payload.targetProfileId,
    person_name: payload.name,
    full_name: payload.name,
    name: payload.name,
    email: payload.email,
  });

  setIfObject(canonical.profile_metadata, {
    ...metadata,
    profile_id: payload.targetProfileId,
    person_name: payload.name,
    full_name: payload.name,
    name: payload.name,
    email: payload.email,
  });

  setIfObject(canonical.identity, {
    profile_id: payload.targetProfileId,
    person_name: payload.name,
    full_name: payload.name,
    name: payload.name,
    email: payload.email,
  });

  replaceAnswerText(canonical.answers, 'name', payload.name);
  replaceAnswerText(canonical.answers, 'full_name', payload.name);
  replaceAnswerText(canonical.answers, 'person_name', payload.name);
  replaceAnswerText(canonical.answers, 'email', payload.email);

  replaceAnswerText(canonical.assessment_answers, 'name', payload.name);
  replaceAnswerText(canonical.assessment_answers, 'full_name', payload.name);
  replaceAnswerText(canonical.assessment_answers, 'person_name', payload.name);
  replaceAnswerText(canonical.assessment_answers, 'email', payload.email);

  return canonical;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const expectedSecret = getAuthSecret();
  const providedSecret = getBearer(req);
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const payload = assertSeedPayload(req.body);
  if (!payload.ok) {
    return res.status(400).json({ error: payload.error });
  }

  let redis;
  try {
    redis = getRedis();

    const targetKey = `vault:profile:${payload.targetProfileId}`;
    const targetExists = await redis.exists(targetKey);
    if (targetExists) {
      return res.status(409).json({ error: 'synthetic_profile_already_exists' });
    }

    const { record: sourceRecord, key: sourceVaultKey } = await readVaultRecord(redis, payload.sourceProfileId);
    if (!sourceRecord) {
      return res.status(404).json({ error: 'source_profile_not_found' });
    }

    const syntheticCanonical = buildSyntheticCanonicalProfile(sourceRecord, payload);

    const saveResult = await saveCanonicalProfile({
      canonical_profile: syntheticCanonical,
      profile_id: payload.targetProfileId,
      job_id: `qa-synthetic-${payload.targetProfileId}`,
      person_name: payload.name,
      email: payload.email,
      company_name: 'QA Synthetic Real Estate Solo Agent',
      assessment_version: 'qa-synthetic-real-estate-solo-agent-v1',
      model: sourceRecord.model || sourceRecord.canonical_profile_json?.metadata?.model || 'qa-synthetic-wally-like-v1',
      intake_answers: sourceRecord.intake_answers || sourceRecord.canonical_profile_json?.intake_answers || {},
      metadata: {
        qa_fixture: true,
        synthetic: true,
        fixture_type: REQUIRED_FIXTURE_TYPE,
        source_behavior_pattern: REQUIRED_SOURCE_PATTERN,
        source_profile_id: payload.sourceProfileId,
        source_vault_key: sourceVaultKey,
        do_not_use_for_real_customer: true,
        source: 'api/diagnostic/seed-synthetic-profile',
        organization: {
          industry: 'Real Estate',
          role_title: 'Solo Real Estate Agent',
          company_name: 'QA Synthetic Real Estate Solo Agent',
          org_context: ['qa_fixture', 'synthetic_real_estate_solo_agent'],
        },
      },
    });

    return res.status(200).json({
      ok: true,
      synthetic_profile_id: saveResult.profile_id,
      source_profile_id: payload.sourceProfileId,
      synthetic: true,
      qa_fixture: true,
      vault_key: saveResult.vault_key,
    });
  } catch (error) {
    console.error('[SEED SYNTHETIC PROFILE] Failed:', error);
    return res.status(500).json({
      ok: false,
      error: 'synthetic_profile_seed_failed',
      message: error.message,
    });
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}
