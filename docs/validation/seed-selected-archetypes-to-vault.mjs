import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { saveCanonicalProfile } from '../../api/engine/vault/saveCanonicalProfile.js';

dotenv.config({ path: process.env.SEED_ENV_FILE || '/private/tmp/moremindmap-production.env' });
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.local', override: false });

const redactSecrets = (value) => String(value).replace(/redis:\/\/[^)\s]+/gi, 'redis://[REDACTED]');
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => originalLog(...args.map(redactSecrets));
console.error = (...args) => originalError(...args.map(redactSecrets));

const root = path.resolve(process.cwd(), 'docs/validation');
const submissionsDir = path.join(root, 'archetype-submissions');
const resultsDir = path.join(root, 'archetype-results');

const selected = [
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
  const baseName = `${id}-${slug}`;
  const canonical = readJson(path.join(resultsDir, `${baseName}-canonical.json`));
  const raw = readJson(path.join(submissionsDir, `${baseName}.json`));
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
      source: 'docs/validation/seed-selected-archetypes-to-vault.mjs',
      archetype: raw.archetype,
      intended_role: raw.intended_role,
      organization,
    },
  });

  return {
    profile_id: result.profile_id,
    vault_key: result.vault_key,
    success: result.success,
  };
}

const results = [];
for (const profile of selected) {
  results.push(await seedProfile(profile));
}

console.log(JSON.stringify({ seeded: results }, null, 2));
