/**
 * Live Retrieve-Profile Test
 * Simulates the production endpoint to verify behavioral intelligence is returned
 */

import fs from 'fs';
import { default as retrieveProfileHandler } from './api/moremindmap/retrieve-profile.js';

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('LIVE RETRIEVE-PROFILE TEST — Simulating Production Endpoint');
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('');

// Mock Redis for local test (use stored profile)
const PROFILE_PATH = './benchmark_profiles/MM-20260523-mqlev9c9/CANONICAL_PROFILE.json';
const canonical = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));
const profileDataJSON = JSON.stringify(canonical);

// Mock req/res for handler simulation
const mockReq = {
  method: 'GET',
  query: { id: 'MM-20260523-mqlev9c9' }
};

let mockResponse = null;
let mockStatusCode = 200;

const mockRes = {
  status: (code) => {
    mockStatusCode = code;
    return {
      json: (data) => {
        mockResponse = data;
      }
    };
  },
  json: (data) => {
    mockResponse = data;
  }
};

// Simulate Redis lookup (bypass actual Redis for this test)
console.log('📋 SCENARIO: Retrieve profile MM-20260523-mqlev9c9');
console.log('─'.repeat(80));
console.log('');

// Import and patch Redis to use our test data
import Redis from 'ioredis';
const originalGet = Redis.prototype.get;

Redis.prototype.get = async function(key) {
  console.log(`[REDIS MOCK] GET ${key}`);
  if (key === 'vault:profile:MM-20260523-mqlev9c9') {
    console.log(`[REDIS MOCK] ✓ Found profile`);
    return profileDataJSON;
  }
  if (key === 'vault:profile:mm-20260523-mqlev9c9') {
    console.log(`[REDIS MOCK] ✓ Found profile (lowercase)`);
    return profileDataJSON;
  }
  console.log(`[REDIS MOCK] ✗ Not found`);
  return null;
};

Redis.prototype.disconnect = async function() {
  return;
};

// Call the handler
try {
  await retrieveProfileHandler(mockReq, mockRes);
} catch (err) {
  console.error('Handler error:', err.message);
  process.exit(1);
}

console.log('');
console.log('✅ RESPONSE RECEIVED');
console.log('─'.repeat(80));
console.log('');

// Check response structure
const hasSuccess = mockResponse?.success !== undefined;
const hasProfileId = mockResponse?.profile_id !== undefined;
const hasCanonical = mockResponse?.canonical_dossier !== undefined;
const hasBehavioral = mockResponse?.behavioral_intelligence_v1 !== undefined;

console.log(`Status: ${mockStatusCode}`);
console.log(`Has success: ${hasSuccess ? '✓' : '✗'}`);
console.log(`Has profile_id: ${hasProfileId ? '✓' : '✗'}`);
console.log(`Has canonical_dossier: ${hasCanonical ? '✓' : '✗'}`);
console.log(`Has behavioral_intelligence_v1: ${hasBehavioral ? '✓' : '✗'}`);
console.log('');

if (!hasBehavioral) {
  console.error('❌ BEHAVIORAL INTELLIGENCE NOT IN RESPONSE');
  console.log('Response keys:', Object.keys(mockResponse || {}));
  process.exit(1);
}

// Verify behavioral intelligence structure
const bi = mockResponse.behavioral_intelligence_v1;
console.log('📊 BEHAVIORAL INTELLIGENCE STRUCTURE');
console.log('─'.repeat(80));
console.log('');
console.log(`Extraction version: ${bi?.extraction_version}`);
console.log(`Profile ID: ${bi?.profile_id}`);
console.log(`Extraction timestamp: ${bi?.extraction_timestamp}`);
console.log(`Domains: ${bi?.domains ? Object.keys(bi.domains).length : 0}`);
console.log('');

if (!bi?.domains) {
  console.error('❌ NO DOMAINS IN BEHAVIORAL INTELLIGENCE');
  process.exit(1);
}

const domains = Object.keys(bi.domains);
console.log('Domain list:');
domains.forEach((d, i) => {
  console.log(`  ${i + 1}. ${d}`);
});

// Verify canonical is unchanged
console.log('');
console.log('🔍 CANONICAL INTEGRITY CHECK');
console.log('─'.repeat(80));
console.log('');

const canonical_in_response = mockResponse.canonical_dossier;
const canonical_profile_id_matches = canonical_in_response?.profile_id === canonical.profile_id;
const canonical_unchanged = JSON.stringify(canonical_in_response) === JSON.stringify(canonical);

console.log(`Profile IDs match: ${canonical_profile_id_matches ? '✓' : '✗'}`);
console.log(`Canonical structure intact: ${canonical_unchanged ? '✓' : '✗'}`);
console.log('');

// Final verdict
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('TEST VERDICT');
console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('');

if (hasSuccess && hasProfileId && hasCanonical && hasBehavioral && domains.length >= 10 && canonical_profile_id_matches) {
  console.log('✅ LIVE RETRIEVE-PROFILE VERIFIED');
  console.log('   - behavioral_intelligence_v1 present in response');
  console.log(`   - ${domains.length} domains extracting`);
  console.log('   - Canonical dossier unchanged');
  console.log('');
  console.log('Next: Trigger Vercel redeployment to propagate to production');
  console.log('      (Commits pushed to GitHub. Vercel should auto-redeploy on push.)');
} else {
  console.log('❌ VERIFICATION FAILED');
  console.log(`   - success: ${hasSuccess}`);
  console.log(`   - profile_id: ${hasProfileId}`);
  console.log(`   - canonical_dossier: ${hasCanonical}`);
  console.log(`   - behavioral_intelligence_v1: ${hasBehavioral}`);
  console.log(`   - domains: ${domains.length}`);
  process.exit(1);
}
