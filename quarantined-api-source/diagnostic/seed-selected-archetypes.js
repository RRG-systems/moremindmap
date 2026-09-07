/**
 * POST /api/diagnostic/seed-selected-archetypes
 *
 * Authenticated one-purpose diagnostic endpoint.
 * Seeds only the Founder/CEO and Accountant synthetic validation profiles
 * through the normal saveCanonicalProfile() Vault path.
 */

import fs from 'fs';
import path from 'path';
import { saveCanonicalProfile } from '../engine/vault/saveCanonicalProfile.js';

const SELECTED = [
  {
    id: 'mm-20260529-ceo8x7q2',
    slug: 'founder-ceo',
  },
  {
    id: 'mm-20260529-acc2f9d6',
    slug: 'accountant',
  },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function seedProfile({ id, slug }) {
  const root = path.join(process.cwd(), 'docs/validation');
  const baseName = `${id}-${slug}`;
  const canonical = readJson(path.join(root, 'archetype-results', `${baseName}-canonical.json`));
  const raw = readJson(path.join(root, 'archetype-submissions', `${baseName}.json`));
  const organization = raw.organizationalMetadata?.organization || {};
  const identity = raw.organizationalMetadata?.identity || {};

  const result = await saveCanonicalProfile({
    canonical_profile: canonical,
    profile_id: id,
    job_id: raw.assessment_id,
    person_name: raw.person_name || identity.full_name || canonical.person_name || null,
    email: raw.email || identity.email || canonical.email || null,
    company_name: organization.company_name || canonical.company_name || null,
    assessment_version: 'synthetic-archetype-validation-v1',
    model: canonical.metadata?.model || 'synthetic-archetype-validation-v1',
    intake_answers: raw.answers || canonical.intake_answers || {},
    metadata: {
      synthetic: true,
      source: 'api/diagnostic/seed-selected-archetypes',
      archetype: raw.archetype,
      intended_role: raw.intended_role,
      organization,
    },
  });

  return {
    profile_id: result.profile_id,
    vault_key: result.vault_key,
    success: result.success === true,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedSecret = process.env.ADMIN_GPT_RESCORE_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!expectedSecret || provided !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const seeded = [];
    for (const profile of SELECTED) {
      seeded.push(await seedProfile(profile));
    }

    return res.status(200).json({
      success: true,
      seeded,
    });
  } catch (error) {
    console.error('[SEED SELECTED ARCHETYPES] Failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
