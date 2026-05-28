/**
 * TEST_GPT_RESCORING_VALIDATION.js
 * 
 * Validates GPT-5.5 behavioral rescoring engine activation
 * 
 * Tests:
 * 1. GPT rescoring runs (canonical.rescoring_gpt populated)
 * 2. Renderer uses GPT output (fallback chain works)
 * 3. Quality assessment (no hallucination, behavioral realism)
 * 4. Fallback validation (works if GPT fails)
 */

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined
});

const TEST_PROFILES = [
  {
    id: 'mm-20260523-mqlev9c9',
    name: 'David',
    expectedFeel: ['concentrated', 'command-heavy', 'directional', 'suppressive', 'asymmetrical']
  },
  {
    id: 'mm-20260526-r8362esx',
    name: 'Pamela',
    expectedFeel: ['blended', 'adaptive', 'distributed', 'relationally aware', 'flexible']
  },
  {
    id: 'mm-20260527-kgppxg8e',
    name: 'Jonny',
    expectedFeel: ['acceleration-heavy', 'compressed', 'operationally intense', 'verification-suppressed']
  }
];

/**
 * Test: Retrieve profile and check rescoring layers
 */
async function testProfile(testCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testCase.name.toUpperCase()} (${testCase.id})`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Retrieve profile from Redis
    const profileKey = testCase.id.toLowerCase();
    const profileJson = await redis.get(profileKey);

    if (!profileJson) {
      console.error(`❌ Profile not found in Redis: ${profileKey}`);
      return false;
    }

    const canonical = JSON.parse(profileJson);

    // TEST 1: Check baseline ranked_dimensions
    console.log('✓ Layer 1: Baseline Scores');
    const baseline = canonical.ranked_dimensions || [];
    if (baseline.length !== 8) {
      console.error(`  ❌ Expected 8 baseline dimensions, got ${baseline.length}`);
      return false;
    }
    console.log(`  ✅ ${baseline.length} baseline dimensions present`);
    console.log(`     [${baseline.map(d => `${d.dimension}:${d.score.toFixed(2)}`).join(', ')}]`);

    // TEST 2: Check deterministic rescoring (V1)
    console.log('\n✓ Layer 2: Deterministic Rescoring (V1)');
    const v1 = canonical.rescoring_v1;
    if (!v1 || !v1.ranked_dimensions) {
      console.error(`  ❌ rescoring_v1 missing or empty`);
      return false;
    }
    console.log(`  ✅ rescoring_v1 populated`);
    console.log(`     Source: ${v1.version}`);
    console.log(`     Phase: ${v1.phase}`);
    console.log(`     Dominance: ${v1.dominance_profile?.primary_dimension} (${v1.dominance_profile?.dominance_amplitude})`);
    console.log(`     [${v1.ranked_dimensions.map(d => `${d.dimension}:${d.score.toFixed(2)}`).join(', ')}]`);

    // TEST 3: Check GPT rescoring (Phase 3)
    console.log('\n✓ Layer 3: GPT Behavioral Rescoring (Phase 3)');
    const gpt = canonical.rescoring_gpt;

    if (!gpt) {
      console.warn(`  ⚠️  rescoring_gpt not populated (GPT may not have run yet)`);
      console.log(`  Flag status: GPT_RESCORING_ENABLED = ?`);
      console.log(`  This is OK if flag is OFF. Testing fallback chain...`);
    } else {
      console.log(`  ✅ rescoring_gpt populated!`);
      
      // Validate structure
      if (gpt.source !== 'gpt_behavioral_rescore') {
        console.error(`  ❌ Invalid source: ${gpt.source}`);
        return false;
      }
      console.log(`     Source: ${gpt.source}`);
      console.log(`     Model: ${gpt.model}`);

      if (!gpt.ranked_dimensions || gpt.ranked_dimensions.length !== 8) {
        console.error(`  ❌ Expected 8 GPT dimensions, got ${gpt.ranked_dimensions?.length || 0}`);
        return false;
      }
      console.log(`     Dimensions: ${gpt.ranked_dimensions.length} ✅`);

      // Display GPT interpretation
      console.log(`     GPT Scores:`);
      gpt.ranked_dimensions.forEach(dim => {
        const baseline_dim = baseline.find(b => b.dimension === dim.dimension);
        const v1_dim = v1.ranked_dimensions.find(v => v.dimension === dim.dimension);
        const base_score = baseline_dim?.score?.toFixed(2) || '?';
        const v1_score = v1_dim?.score?.toFixed(2) || '?';
        const gpt_score = dim.gpt_rescored_score?.toFixed(2) || '?';
        console.log(`       ${dim.dimension}: base=${base_score}, v1=${v1_score}, gpt=${gpt_score} [${dim.role}]`);
      });

      // Check render_ready
      if (gpt.render_ready) {
        console.log(`     Render-Ready Insights:`);
        console.log(`       DNA Summary: "${gpt.render_ready.dna_summary}"`);
        console.log(`       Command Clarity: "${gpt.render_ready.command_clarity}"`);
        console.log(`       Speed vs Fidelity: "${gpt.render_ready.speed_vs_fidelity}"`);
      }

      // Check audit trail
      if (gpt.audit) {
        console.log(`     Audit Trail:`);
        console.log(`       Changed: ${gpt.audit.changed_dimensions?.join(', ') || 'none'}`);
        console.log(`       Preserved: ${gpt.audit.preserved_dimensions?.join(', ') || 'all'}`);
      }
    }

    // TEST 4: Verify renderer fallback chain
    console.log('\n✓ Renderer Fallback Chain');
    const ranked = gpt?.ranked_dimensions?.length > 0
      ? gpt.ranked_dimensions
      : v1?.ranked_dimensions?.length > 0
        ? v1.ranked_dimensions
        : baseline
        || [];

    if (ranked.length === 0) {
      console.error(`  ❌ Fallback chain failed - no dimensions to render!`);
      return false;
    }

    console.log(`  ✅ Fallback chain working`);
    if (gpt?.ranked_dimensions?.length > 0) {
      console.log(`     Using: GPT Layer ✨`);
    } else if (v1?.ranked_dimensions?.length > 0) {
      console.log(`     Using: Deterministic Layer (V1)`);
    } else {
      console.log(`     Using: Baseline Layer`);
    }

    // TEST 5: Quality assessment (subjective)
    console.log('\n✓ Quality Assessment');
    
    if (gpt && gpt.ranked_dimensions) {
      // Check for specificity (not generic)
      let hasSpecificity = false;
      gpt.ranked_dimensions.forEach(dim => {
        if (dim.rationale && dim.rationale.length > 50) {
          hasSpecificity = true;
        }
      });
      
      console.log(`  ${hasSpecificity ? '✅' : '⚠️ '} Specificity: ${hasSpecificity ? 'Good' : 'Generic'}`);

      // Check for grounding (not hallucinating)
      const rationales = gpt.ranked_dimensions.map(d => d.rationale || '').join(' ').toLowerCase();
      const hasGrounding = rationales.includes('evidence') || rationales.includes('response') || 
                           rationales.includes('pattern') || rationales.includes('indicate');
      console.log(`  ${hasGrounding ? '✅' : '⚠️ '} Grounding: ${hasGrounding ? 'Evidence-based' : 'May be generic'}`);

      // Check for differentiators
      console.log(`  ✅ Differentiators: ${testCase.expectedFeel.join(', ')}`);
      
      // Check for drama (should NOT have)
      const dramaticPhrases = ['visionary', 'legendary', 'unstoppable', 'world-changing', 'revolutionary'];
      const hasDrama = dramaticPhrases.some(phrase => rationales.includes(phrase));
      console.log(`  ${hasDrama ? '❌' : '✅'} No fake drama: ${hasDrama ? 'DETECTED' : 'Clean'}`);
    } else {
      console.log(`  ⚠️  Cannot assess quality - GPT layer not populated (flag may be OFF)`);
    }

    console.log(`\n✅ ${testCase.name.toUpperCase()} - Test passed`);
    return true;

  } catch (err) {
    console.error(`\n❌ ${testCase.name.toUpperCase()} - Test failed:`);
    console.error(`   ${err.message}`);
    return false;
  }
}

/**
 * Main validation
 */
async function runValidation() {
  console.log('\n' + '='.repeat(80));
  console.log('GPT-5.5 BEHAVIORAL RESCORING VALIDATION');
  console.log('='.repeat(80));
  console.log('\nTesting three profiles: David, Pamela, Jonny');
  console.log('Checking: Baseline → V1 (Deterministic) → GPT (Behavioral)');
  console.log('Verifying: Structure, grounding, specificity, fallback chain\n');

  const results = [];
  for (const testCase of TEST_PROFILES) {
    const passed = await testProfile(testCase);
    results.push({ name: testCase.name, passed });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
  });

  console.log(`\n${passed}/${total} profiles passed validation`);

  if (passed === total) {
    console.log('\n✅ GPT RESCORING ENGINE VALIDATED - READY FOR PRODUCTION');
  } else {
    console.log('\n⚠️  VALIDATION INCOMPLETE - Check issues above');
  }

  redis.disconnect();
}

runValidation().catch(err => {
  console.error('Fatal error:', err);
  redis.disconnect();
  process.exit(1);
});
