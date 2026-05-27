/**
 * TEST_ACTUAL_RETRIEVE.js
 * 
 * Tests actual profile retrieval from vault
 * Uses retrieve-profile endpoint to get real canonical data
 */

const API_BASE = process.env.API_BASE || 'https://moremindmap.vercel.app';

const profileIds = [
  'MM-20260523-mqlev9c9',  // David
  'mm-20260526-r8362esx',  // Pamela
  'mm-20260527-kgppxg8e'   // Jonny
];

async function testRetrieveProfile(profileId) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`RETRIEVE: ${profileId}`);
  console.log(`${'─'.repeat(80)}\n`);
  
  try {
    const url = `${API_BASE}/api/moremindmap/retrieve-profile?id=${profileId}`;
    console.log(`[RETRIEVE] Calling: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`[RETRIEVE] ✗ HTTP ${response.status}`);
      const data = await response.json();
      console.log(`  Error: ${data.error}`);
      return;
    }
    
    const data = await response.json();
    
    console.log(`[RETRIEVE] ✅ Profile retrieved`);
    console.log(`  success: ${data.success}`);
    console.log(`  profile_id: ${data.profile_id}`);
    console.log(`  canonical_dossier keys: ${data.canonical_dossier ? Object.keys(data.canonical_dossier).slice(0, 15).join(', ') : 'null'}`);
    console.log(`  behavioral_intelligence_v1: ${data.behavioral_intelligence_v1 ? '✓ present' : '✗ NULL'}`);
    
    if (data.behavioral_intelligence_v1) {
      console.log(`  BI domains: ${Object.keys(data.behavioral_intelligence_v1.domains || {}).join(', ')}`);
      if (data.behavioral_intelligence_v1.domains?.fiveFutures) {
        console.log(`  fiveFutures.futures length: ${data.behavioral_intelligence_v1.domains.fiveFutures.futures?.length}`);
      }
    }
    
  } catch (error) {
    console.error(`[RETRIEVE] ✗ Error:`);
    console.error(`  ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('TEST: Actual profile retrieval from vault');
console.log('='.repeat(80));

(async () => {
  for (const profileId of profileIds) {
    await testRetrieveProfile(profileId);
  }
  console.log(`\n${'='.repeat(80)}\n`);
})();
