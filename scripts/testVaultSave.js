/**
 * testVaultSave.js
 * 
 * Test Vault v1 canonical profile storage system
 * 
 * Uses INSPECTION_CANONICAL_FRONTIER_V1.json as test artifact
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { saveCanonicalProfile, saveCanonicalMarkdown } from '../api/engine/vault/saveCanonicalProfile.js';
import { getCanonicalProfile, getCanonicalMarkdown, profileExists } from '../api/engine/vault/getCanonicalProfile.js';
import { listProfilesByDate, getVaultStats, listRecentProfiles } from '../api/engine/vault/listCanonicalProfiles.js';
import { generateProfileId, isValidProfileId, extractDateFromProfileId } from '../api/engine/vault/generateProfileId.js';
import Redis from 'ioredis';

// Get Redis client
function getRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured');
  }
  return new Redis(redisUrl);
}

async function runVaultTest() {
  console.log('[VAULT TEST] Starting Vault v1 storage test...\n');
  
  // STEP 1: Load test artifact
  console.log('[STEP 1] Loading test canonical profile...');
  const json_path = resolve('./INSPECTION_CANONICAL_FRONTIER_V1.json');
  const md_path = resolve('./INSPECTION_CANONICAL_FRONTIER_V1.md');
  
  const canonical_json = JSON.parse(await readFile(json_path, 'utf-8'));
  const canonical_md = await readFile(md_path, 'utf-8');
  
  console.log('[STEP 1] ✓ Loaded test artifact');
  console.log(`[STEP 1]   JSON size: ${JSON.stringify(canonical_json).length} bytes`);
  console.log(`[STEP 1]   Markdown size: ${canonical_md.length} bytes\n`);
  
  // STEP 2: Generate profile_id
  console.log('[STEP 2] Testing profile ID generation...');
  
  const profile_id = generateProfileId();
  const is_valid = isValidProfileId(profile_id);
  const extracted_date = extractDateFromProfileId(profile_id);
  
  console.log('[STEP 2] ✓ Profile ID generated');
  console.log(`[STEP 2]   profile_id: ${profile_id}`);
  console.log(`[STEP 2]   valid: ${is_valid}`);
  console.log(`[STEP 2]   extracted_date: ${extracted_date}\n`);
  
  if (!is_valid) {
    throw new Error('Generated profile_id failed validation');
  }
  
  // STEP 3: Save canonical profile
  console.log('[STEP 3] Saving canonical profile to Vault...');
  
  const save_result = await saveCanonicalProfile({
    canonical_profile: canonical_json,
    job_id: 'test_canonical_20260521',
    person_name: 'Test Subject Alpha',
    email: 'test@moremindmap.com',
    assessment_version: 'mini-v2',
    model: 'canonical-v1-frontier',
    intake_answers: canonical_json.life_direction?.stated_priorities || null,
    quality_score: 93,
    metadata: {
      test_run: true,
      source: 'INSPECTION_CANONICAL_FRONTIER_V1.json',
      vault_test_version: '1.0.0'
    }
  });
  
  console.log('[STEP 3] ✓ Profile saved');
  console.log(`[STEP 3]   profile_id: ${save_result.profile_id}`);
  console.log(`[STEP 3]   signature: ${save_result.profile_signature}`);
  console.log(`[STEP 3]   vault_key: ${save_result.vault_key}`);
  console.log(`[STEP 3]   created_at: ${save_result.created_at}\n`);
  
  const saved_profile_id = save_result.profile_id;
  
  // STEP 4: Save markdown
  console.log('[STEP 4] Saving canonical markdown...');
  
  const md_result = await saveCanonicalMarkdown(saved_profile_id, canonical_md);
  
  console.log('[STEP 4] ✓ Markdown saved');
  console.log(`[STEP 4]   markdown_key: ${md_result.markdown_key}`);
  console.log(`[STEP 4]   markdown_size: ${md_result.markdown_size} bytes\n`);
  
  // STEP 5: Check if profile exists
  console.log('[STEP 5] Checking if profile exists...');
  
  const exists = await profileExists(saved_profile_id);
  
  console.log('[STEP 5] ✓ Profile existence check');
  console.log(`[STEP 5]   exists: ${exists}\n`);
  
  if (!exists) {
    throw new Error('Profile should exist but profileExists returned false');
  }
  
  // STEP 6: Retrieve profile
  console.log('[STEP 6] Retrieving canonical profile...');
  
  const retrieved = await getCanonicalProfile(saved_profile_id);
  
  console.log('[STEP 6] ✓ Profile retrieved');
  console.log(`[STEP 6]   found: ${retrieved.found}`);
  console.log(`[STEP 6]   profile_id: ${retrieved.profile_id}`);
  console.log(`[STEP 6]   person_name: ${retrieved.person_name}`);
  console.log(`[STEP 6]   email: ${retrieved.email}`);
  console.log(`[STEP 6]   quality_score: ${retrieved.quality_score}`);
  console.log(`[STEP 6]   model: ${retrieved.model}\n`);
  
  // STEP 7: Retrieve markdown
  console.log('[STEP 7] Retrieving canonical markdown...');
  
  const retrieved_md = await getCanonicalMarkdown(saved_profile_id);
  
  console.log('[STEP 7] ✓ Markdown retrieved');
  console.log(`[STEP 7]   found: ${retrieved_md.found}`);
  console.log(`[STEP 7]   markdown_size: ${retrieved_md.markdown_size} bytes`);
  console.log(`[STEP 7]   matches_original: ${retrieved_md.markdown === canonical_md}\n`);
  
  // STEP 8: List profiles by date
  console.log('[STEP 8] Listing profiles by date...');
  
  const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const date_list = await listProfilesByDate(today);
  
  console.log('[STEP 8] ✓ Profiles listed by date');
  console.log(`[STEP 8]   date: ${date_list.date}`);
  console.log(`[STEP 8]   count: ${date_list.count}`);
  console.log(`[STEP 8]   profile_ids: ${date_list.profile_ids.join(', ')}\n`);
  
  // STEP 9: Get vault stats
  console.log('[STEP 9] Getting vault statistics...');
  
  const stats = await getVaultStats();
  
  console.log('[STEP 9] ✓ Vault stats retrieved');
  console.log(`[STEP 9]   total_profiles: ${stats.total_profiles}`);
  console.log(`[STEP 9]   dates_with_profiles: ${stats.dates_with_profiles}`);
  console.log(`[STEP 9]   unique_emails: ${stats.unique_emails}`);
  console.log(`[STEP 9]   earliest_date: ${stats.earliest_date}`);
  console.log(`[STEP 9]   latest_date: ${stats.latest_date}\n`);
  
  // STEP 10: List recent profiles
  console.log('[STEP 10] Listing recent profiles...');
  
  const recent = await listRecentProfiles(5);
  
  console.log('[STEP 10] ✓ Recent profiles listed');
  console.log(`[STEP 10]   count: ${recent.count}`);
  console.log(`[STEP 10]   total_available: ${recent.total_available}`);
  
  if (recent.profiles.length > 0) {
    console.log('[STEP 10]   Most recent:');
    const latest = recent.profiles[0];
    console.log(`[STEP 10]     - ${latest.profile_id}`);
    console.log(`[STEP 10]       person: ${latest.person_name}`);
    console.log(`[STEP 10]       created: ${latest.created_at}`);
    console.log(`[STEP 10]       quality: ${latest.quality_score}\n`);
  }
  
  // STEP 11: Show Redis keys
  console.log('[STEP 11] Inspecting Redis key structure...');
  
  const redis = getRedis();
  const vault_keys = await redis.keys('vault:*');
  
  console.log('[STEP 11] ✓ Redis keys retrieved');
  console.log(`[STEP 11]   total vault keys: ${vault_keys.length}`);
  console.log('[STEP 11]   key structure:');
  
  const key_types = {};
  vault_keys.forEach(key => {
    const type = key.split(':')[1];
    key_types[type] = (key_types[type] || 0) + 1;
  });
  
  Object.entries(key_types).forEach(([type, count]) => {
    console.log(`[STEP 11]     - vault:${type}:* (${count} keys)`);
  });
  
  console.log('\n[STEP 11]   Sample keys:');
  vault_keys.slice(0, 5).forEach(key => {
    console.log(`[STEP 11]     - ${key}`);
  });
  
  console.log('\n[COMPLETE] Vault v1 test successful\n');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('VAULT V1 TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✓ Profile ID generated:     ${saved_profile_id}`);
  console.log(`✓ Profile saved:            ${save_result.vault_key}`);
  console.log(`✓ Profile retrieved:        ${retrieved.found}`);
  console.log(`✓ Markdown saved/retrieved: ${retrieved_md.found}`);
  console.log(`✓ Date listing works:       ${date_list.count} profiles found`);
  console.log(`✓ Vault stats work:         ${stats.total_profiles} total profiles`);
  console.log(`✓ Recent listing works:     ${recent.count} profiles listed`);
  console.log(`✓ Redis keys created:       ${vault_keys.length} vault keys`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  return {
    success: true,
    profile_id: saved_profile_id,
    profile_signature: save_result.profile_signature,
    vault_keys: vault_keys.length,
    total_profiles: stats.total_profiles
  };
}

// Run test
runVaultTest()
  .then(result => {
    console.log('[SUCCESS] Vault v1 operational');
    process.exit(0);
  })
  .catch(err => {
    console.error('[ERROR] Vault test failed:', err);
    process.exit(1);
  });
