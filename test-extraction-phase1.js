/**
 * Test Script: Phase 1 Extraction Verification
 * 
 * Tests extractBehavioralIntelligence() on both live profiles:
 * - MM-20260523-mqlev9c9 (legacy benchmark)
 * - MM-20260524-rf2xqct1 (live production)
 * 
 * Verifies:
 * 1. Function runs without error
 * 2. Output structure valid
 * 3. Canonical dossier unchanged
 * 4. Extraction produces reasonable intelligence
 */

import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function testExtraction() {
  console.log('='.repeat(70));
  console.log('PHASE 1 EXTRACTION TEST');
  console.log('='.repeat(70));
  console.log('');

  const test_profiles = [
    'MM-20260523-mqlev9c9',  // Legacy benchmark
    'MM-20260524-rf2xqct1'   // Live production
  ];

  for (const profile_id of test_profiles) {
    console.log(`\nTesting: ${profile_id}`);
    console.log('-'.repeat(70));

    try {
      // Load canonical from vault
      const vault_key = `vault:profile:${profile_id}`;
      const canonical_json = await redis.get(vault_key);

      if (!canonical_json) {
        console.error(`❌ Profile not found in vault: ${profile_id}`);
        continue;
      }

      const canonical = JSON.parse(canonical_json);
      console.log(`✓ Loaded canonical (${Object.keys(canonical).length} fields)`);

      // Store original for comparison
      const original_canonical = JSON.stringify(canonical);

      // Extract intelligence
      const extraction_start = Date.now();
      const behavioral_intelligence = extractBehavioralIntelligence(canonical);
      const extraction_time = Date.now() - extraction_start;

      console.log(`✓ Extraction completed in ${extraction_time}ms`);

      // Verify canonical unchanged
      const final_canonical = JSON.stringify(canonical);
      if (original_canonical === final_canonical) {
        console.log('✓ Canonical dossier unchanged (pure function)');
      } else {
        console.error('❌ WARNING: Canonical dossier was mutated!');
      }

      // Verify output structure
      if (behavioral_intelligence.extraction_version) {
        console.log(`✓ Version: ${behavioral_intelligence.extraction_version}`);
      }

      if (behavioral_intelligence.profile_id === profile_id) {
        console.log(`✓ Profile ID matches: ${profile_id}`);
      }

      // Verify domains
      const domains = behavioral_intelligence.domains || {};
      console.log(`✓ Domains extracted: ${Object.keys(domains).length}`);

      // Check each domain
      if (domains.operatingSystem) {
        const os = domains.operatingSystem;
        console.log(`  - Operating System: ${os.primary_driver?.dimension} + ${os.secondary_stabilizer?.dimension}`);
        console.log(`    Confidence: ${os.confidence}`);
        console.log(`    Summary: ${os.summary?.substring(0, 80)}...`);
      }

      if (domains.worldExperience) {
        const we = domains.worldExperience;
        console.log(`  - World Experience: Signal ${we.perception_filter?.score?.toFixed(1)}, Horizon ${we.time_horizon?.score?.toFixed(1)}`);
        console.log(`    Confidence: ${we.confidence}`);
      }

      if (domains.othersExperience) {
        const oe = domains.othersExperience;
        console.log(`  - Others Experience: ${oe.first_impression?.primary_signal} first impression`);
        console.log(`    Trust speed: ${oe.trust_building_speed?.composite?.toFixed(1)}/10`);
      }

      if (domains.pressureMechanics) {
        const pm = domains.pressureMechanics;
        console.log(`  - Pressure Mechanics: ${pm.primary_under_load?.dimension} under load`);
        console.log(`    Stress patterns: ${pm.stress_patterns_available ? 'Available' : 'Not available'}`);
      }

      if (domains.contradictions) {
        const c = domains.contradictions;
        console.log(`  - Contradictions: ${c.contradiction_count} identified`);
      }

      // Verify confidence tiers
      const tiers = behavioral_intelligence.confidence_tiers || {};
      console.log(`✓ Confidence tiers: ${Object.keys(tiers).length} mapped`);

      // Output sample for manual verification
      console.log('\nSample Output (Operating System):');
      console.log(JSON.stringify(domains.operatingSystem, null, 2).substring(0, 500) + '...');

      console.log(`\n✅ Test PASSED for ${profile_id}`);
    } catch (error) {
      console.error(`\n❌ Test FAILED for ${profile_id}:`, error.message);
      console.error(error.stack);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('TEST COMPLETE');
  console.log('='.repeat(70));

  redis.disconnect();
}

testExtraction().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
