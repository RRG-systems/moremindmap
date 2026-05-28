/**
 * TEST_ADMIN_RESCORE_ENDPOINT.js
 * 
 * Test the admin rescore-profile endpoint
 * 
 * Usage: node TEST_ADMIN_RESCORE_ENDPOINT.js [environment]
 * Examples:
 *   node TEST_ADMIN_RESCORE_ENDPOINT.js local
 *   node TEST_ADMIN_RESCORE_ENDPOINT.js production
 */

const TEST_PROFILES = [
  {
    id: 'mm-20260523-mqlev9c9',
    name: 'David (extreme vector)',
    expectedPrimary: 'vector'
  },
  {
    id: 'mm-20260526-r8362esx',
    name: 'Pamela (balanced)',
    expectedPrimary: 'signal' // or balanced
  },
  {
    id: 'mm-20260527-kgppxg8e',
    name: 'Jonny (concentrated)',
    expectedPrimary: 'vector'
  }
];

const environment = process.argv[2] || 'local';
const baseUrl = environment === 'production'
  ? 'https://moremindmap.com'
  : 'http://localhost:3000';

const adminSecret = environment === 'production'
  ? process.env.ADMIN_GPT_RESCORE_SECRET || 'MISSING_SECRET'
  : 'dev_secret_12345';

async function testEndpoint(profileId, profileName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${profileName}`);
  console.log(`${'='.repeat(80)}`);

  try {
    console.log(`\nCalling: POST ${baseUrl}/api/admin/rescore-profile`);
    console.log(`Profile ID: ${profileId}`);
    console.log(`Auth: Bearer ${adminSecret.substring(0, 10)}...`);

    const response = await fetch(`${baseUrl}/api/admin/rescore-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`
      },
      body: JSON.stringify({
        profile_id: profileId,
        force: false,
        debug: false
      })
    });

    console.log(`\nResponse Status: ${response.status}`);

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ ERROR: ${data.error || 'Unknown error'}`);
      if (data.validation_errors) {
        console.error('Validation errors:');
        data.validation_errors.forEach(err => console.error(`  - ${err}`));
      }
      return false;
    }

    console.log(`✅ SUCCESS`);
    console.log(`\nResponse:`);
    console.log(`  - Profile ID: ${data.profile_id}`);
    console.log(`  - Rescoring GPT Saved: ${data.rescoring_gpt_saved}`);
    console.log(`  - Source: ${data.source}`);
    console.log(`  - Model: ${data.model}`);
    console.log(`  - Primary Dimension: ${data.primary_dimension}`);
    console.log(`  - Secondary Dimension: ${data.secondary_dimension}`);
    console.log(`  - Dominance Amplitude: ${data.dominance_amplitude}`);
    console.log(`  - Profile Intensity: ${data.profile_intensity}`);
    console.log(`  - Ranked Count: ${data.ranked_count}`);
    console.log(`  - Refreshed At: ${data.refreshed_at}`);
    console.log(`  - Previous Existed: ${data.previous_existed}`);
    console.log(`  - Render Ready Keys: ${data.render_ready_keys.join(', ')}`);

    return true;

  } catch (err) {
    console.error(`❌ FETCH ERROR: ${err.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('ADMIN RESCORE ENDPOINT TEST');
  console.log('='.repeat(80));
  console.log(`\nEnvironment: ${environment}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Admin Secret: ${adminSecret.substring(0, 15)}...`);
  console.log(`\nTesting ${TEST_PROFILES.length} profiles...`);

  const results = [];
  for (const profile of TEST_PROFILES) {
    const passed = await testEndpoint(profile.id, profile.name);
    results.push({ name: profile.name, passed });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });

  console.log(`\n${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED - Admin rescore endpoint is working!');
  } else {
    console.log('\n⚠️  Some tests failed - check above for details');
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
