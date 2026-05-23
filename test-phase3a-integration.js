/**
 * Test Phase 3A Integration
 * 
 * Tests:
 * 1. Profile ID consistency (wrapper vs internal)
 * 2. Markdown export present
 * 3. Phase 3A narrative upgrades applied
 * 4. Preamble metadata preserved
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createJob, getJob } from './api/engine/miniV2JobManager.js';
import { executeNextStage } from './api/engine/miniV2StagedExecutor.js';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Redis client
function getRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl);
}

async function testPhase3AIntegration() {
  console.log('\n=== PHASE 3A INTEGRATION TEST ===\n');
  
  const redis = getRedis();
  
  // Test data matching Page 0A + Page 0B structure
  const testMetadata = {
    person_name: 'Test Subject',
    email: 'test.subject@example.com',
    organization: {
      company: 'Test Corp',
      department: 'Operations',
      role_title: 'VP Operations',
      reports_to: 'CEO',
      direct_reports_count: '10-15',
      years_in_current_role: '2-3',
      years_in_industry: '10+',
      industry: 'Finance',
      org_context: ['Executive/C-Suite', 'Operations/Process']
    },
    identity: {
      full_name: 'Test Subject',
      email: 'test.subject@example.com',
      phone: '+1-555-0123'
    },
    contextual_signals: {
      best_role_ever: 'Early-stage startup where I owned systems',
      best_role_why: 'Clear ownership, immediate feedback',
      worst_role_ever: 'Big 4 consulting',
      worst_role_why: 'Hidden labor, burnout',
      current_energy_drain: 'Executive dysfunction, constant fires',
      current_role_misalignment: 'Hired to scale, actually absorbing chaos',
      avoided_work: 'Conflict conversations',
      recurring_org_frustration: 'Smart people making avoidable mistakes',
      relied_on_for: 'Getting things done when broken',
      misunderstood_for: 'Cold, indifferent',
      unrealized_capacity: 'Never built sustainable systems at scale'
    }
  };
  
  const testAnswers = {
    q1: { text: 'Speed vs quality in decision-making' },
    q2: { text: 'Small teams with clear missions' },
    q3: { text: 'More decisive, less consultative' },
    q4: { text: 'Build systems that work' },
    q5: { text: 'Deep one-on-ones with trusted people' },
    q6: { text: 'System integrity over stakeholder harmony' },
    q7: { text: 'Learning from failure and brilliant people' },
    q8: { text: 'Solving complex operational problems' },
    q9: { text: 'Politics, meetings with no decisions' },
    q10: { text: 'Problem solver, systems thinker' },
    q11: { text: 'Avoiding firefighting mode' },
    q12: { text: 'Working with thoughtful people' },
    q13: { text: 'Political environments' },
    q14: { text: 'Moving from chaos to order' },
    q15: { text: 'Repeated crises, insufficient authority' },
    q16: { text: 'Yes, systems thinking' },
    q17: { text: 'Yes, directness under pressure' },
    q18: { text: 'Yes, absorbing unilateral responsibility' },
    q19: { text: 'No, mostly execution focus' },
    q20: { text: 'Yes, capacity planning gaps' },
    q21: { text: 'Yes, relational friction' },
    q22: { text: 'Clear authority and ownership' },
    q23: { text: 'Team trust and delegation' },
    q24: { text: 'Sustainable systems building' },
    q25: { text: 'Yes, conflict avoidance' },
    q26: { text: 'No, strong under pressure' },
    q27: { text: 'Strategic systems design' },
    q28: { text: 'Organizational scaling' }
  };
  
  try {
    // Step 1: Create job
    console.log('[TEST] Creating job with Phase 0A + 0B metadata...');
    const job_id = await createJob({
      answers: testAnswers,
      metadata: testMetadata
    });
    console.log(`✓ Job created: ${job_id}`);
    
    // Step 2: Run job to completion
    console.log('\n[TEST] Executing job pipeline...');
    let job = await getJob(job_id);
    
    let iterations = 0;
    const maxIterations = 15;
    while (job.status !== 'complete' && job.status !== 'failed' && iterations < maxIterations) {
      iterations++;
      console.log(`  Iteration ${iterations}: stage = ${job.stage}`);
      
      try {
        const result = await executeNextStage(job);
        job = await getJob(job_id);
      } catch (err) {
        console.error(`  Stage execution error: ${err.message}`);
        job = await getJob(job_id);
        if (job.status === 'failed') break;
      }
    }
    
    console.log(`✓ Job completed in ${iterations} iterations`);
    console.log(`  Final status: ${job.status}`);
    
    // Step 3: Check profile ID consistency
    console.log('\n[TEST] Checking profile ID consistency...');
    const wrapper_profile_id = job.canonical_profile_id;
    console.log(`  Wrapper profile_id: ${wrapper_profile_id}`);
    
    if (!job.canonical_profile || !job.canonical_profile.profile_id) {
      console.warn('  ⚠ Internal canonical profile missing');
    } else {
      const internal_profile_id = job.canonical_profile.profile_id;
      console.log(`  Internal profile_id: ${internal_profile_id}`);
      
      if (wrapper_profile_id === internal_profile_id) {
        console.log('  ✓ Profile IDs MATCH');
      } else {
        console.log(`  ✗ Profile IDs DO NOT MATCH`);
      }
    }
    
    // Step 4: Check metadata preservation
    console.log('\n[TEST] Checking metadata preservation...');
    const canonical_metadata = job.canonical_profile?.metadata;
    
    if (canonical_metadata?.identity) {
      console.log('  ✓ identity metadata present');
    } else {
      console.log('  ✗ identity metadata missing');
    }
    
    if (canonical_metadata?.organization) {
      console.log('  ✓ organization metadata present');
      console.log(`    company: ${canonical_metadata.organization.company}`);
      console.log(`    org_context: ${canonical_metadata.organization.org_context?.join(', ')}`);
    } else {
      console.log('  ✗ organization metadata missing');
    }
    
    if (canonical_metadata?.contextual_signals) {
      console.log('  ✓ contextual_signals metadata present');
      const signalCount = Object.keys(canonical_metadata.contextual_signals).length;
      console.log(`    signals captured: ${signalCount}`);
    } else {
      console.log('  ✗ contextual_signals metadata missing');
    }
    
    // Step 5: Check markdown export
    console.log('\n[TEST] Checking markdown export...');
    const markdown_key = `vault:markdown:${wrapper_profile_id}`;
    const markdown_exists = await redis.exists(markdown_key);
    
    if (markdown_exists) {
      console.log('  ✓ Markdown export present in Vault');
      const markdown_size = await redis.strlen(markdown_key);
      console.log(`    Size: ${markdown_size} bytes`);
    } else {
      console.log('  ✗ Markdown export missing from Vault');
    }
    
    // Step 6: Check narrative sections
    console.log('\n[TEST] Checking Phase 3A narrative upgrades...');
    const narratives = job.canonical_profile?.narratives || {};
    
    const sections_to_check = [
      'executive_summary',
      'leadership_narrative',
      'decision_narrative'
    ];
    
    const banned_phrases = [
      'underutilized',
      'works best in aligned',
      'aligned environments',
      'growth potential'
    ];
    
    for (const section of sections_to_check) {
      const text = narratives[section] || '';
      console.log(`\n  [${section}]`);
      
      if (!text) {
        console.log('    ✗ Section missing');
        continue;
      }
      
      if (text.length < 200) {
        console.log('    ⚠ Section seems short (generic baseline?)');
      } else {
        console.log(`    ✓ Section present (${text.length} chars)`);
      }
      
      let has_banned = false;
      for (const phrase of banned_phrases) {
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          console.log(`      ✗ Contains banned phrase: "${phrase}"`);
          has_banned = true;
        }
      }
      
      if (!has_banned) {
        console.log('    ✓ No banned phrases detected');
      }
      
      // Sample output
      console.log(`    First 200 chars: ${text.substring(0, 200)}...`);
    }
    
    // Step 7: Vault indexes check
    console.log('\n[TEST] Checking Vault indexes...');
    
    const company_slug = 'test-corp';
    const company_index_key = `vault:index:company:${company_slug}`;
    const profiles_in_company = await redis.smembers(company_index_key);
    
    if (profiles_in_company.includes(wrapper_profile_id)) {
      console.log('  ✓ Profile indexed by company');
    } else {
      console.log('  ✗ Profile NOT indexed by company');
    }
    
    const org_context_index_key = 'vault:index:org_context:executive-c-suite';
    const profiles_in_context = await redis.smembers(org_context_index_key);
    
    if (profiles_in_context.includes(wrapper_profile_id)) {
      console.log('  ✓ Profile indexed by org_context');
    } else {
      console.log('  ✗ Profile NOT indexed by org_context');
    }
    
    // Step 8: Summary
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Job ID: ${job_id}`);
    console.log(`Profile ID: ${wrapper_profile_id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Metadata preserved: ${canonical_metadata ? 'YES' : 'NO'}`);
    console.log(`Markdown exported: ${markdown_exists ? 'YES' : 'NO'}`);
    console.log('\n');
    
    // Return test results for inspection
    return {
      job_id,
      profile_id: wrapper_profile_id,
      success: job.status === 'complete',
      test_passed: job.status === 'complete' && markdown_exists && wrapper_profile_id,
      details: {
        status: job.status,
        markdown_present: !!markdown_exists,
        metadata_preserved: !!canonical_metadata?.organization,
        narratives: sections_to_check.map(s => ({
          section: s,
          present: !!narratives[s],
          length: (narratives[s] || '').length
        }))
      }
    };
    
  } catch (error) {
    console.error('\n[ERROR] Test failed:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test
testPhase3AIntegration()
  .then(result => {
    console.log('\n[COMPLETE] Test execution finished');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('\n[FATAL] Uncaught error:', err);
    process.exit(1);
  });
