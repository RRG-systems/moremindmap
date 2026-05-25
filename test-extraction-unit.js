/**
 * Unit Test: Phase 1 Extraction with Mock Data
 * 
 * Tests extractBehavioralIntelligence() with realistic mock canonical data
 * (no Redis dependency)
 */

import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';

// Mock canonical dossier (realistic structure)
const mock_canonical = {
  profile_id: 'mm-test-unit-001',
  metadata: {
    assessment_version: 'mini-v2',
    generated_at: new Date().toISOString()
  },
  vector_scores: {
    vector: 7.2,
    signal: 6.8,
    fidelity: 4.5,
    velocity: 7.0,
    leverage: 6.5,
    flex: 5.2,
    framework: 5.8,
    horizon: 7.5
  },
  ranked_dimensions: [
    { dimension: 'vector', score: 7.2, rank: 1 },
    { dimension: 'velocity', score: 7.0, rank: 2 },
    { dimension: 'horizon', score: 7.5, rank: 3 }
  ],
  top_systems: {
    primary_driver: {
      dimension: 'vector',
      score: 7.2,
      rank: 1,
      description: 'High on command',
      operating_manifestation: 'Enters with direction, takes ownership immediately',
      pressure_manifestation: 'Under pressure, intensifies command—pushes harder, faster, more directive'
    },
    secondary_stabilizer: {
      dimension: 'horizon',
      score: 7.5,
      rank: 3,
      description: 'High on strategic vision',
      operating_manifestation: 'Maintains long-term perspective, thinks in quarters',
      pressure_manifestation: 'Under pressure, pulls back to big picture—reframes short-term as strategic move'
    },
    opposing_pattern_1: {
      dimension: 'fidelity',
      score: 4.5,
      rank: 6,
      description: 'Moderate on precision',
      operating_manifestation: 'Satisficing on details, prioritizes momentum'
    },
    opposing_pattern_2: {
      dimension: 'flex',
      score: 5.2,
      rank: 5,
      description: 'Moderate on adaptability',
      operating_manifestation: 'Adjusts when necessary but prefers conviction'
    },
    dimension_tradeoffs: [
      {
        dimensions: ['vector', 'fidelity'],
        tradeoff: 'Speed vs Precision',
        cost: 'Missing details that matter later',
        manifestation: 'Moves fast, catches errors in month 2-3'
      }
    ]
  },
  contradictions: [
    {
      type: 'knowledge_execution_gap',
      primary_dimension: 'vector',
      secondary_dimension: 'fidelity',
      cost: 'Knows details matter, still moves without them',
      resolution_attempted: false
    }
  ],
  stress_patterns: {
    vector: {
      normal: 7.2,
      under_load: 8.5,
      threshold: 'High sustained demand'
    }
  },
  narrative_profile: {
    profileDNA: 'Command-driven operator',
    executiveSummary: 'Moves with conviction',
    operatingPattern: 'Direction-first'
  }
};

function runUnitTest() {
  console.log('='.repeat(70));
  console.log('PHASE 1 EXTRACTION - UNIT TEST (Mock Data)');
  console.log('='.repeat(70));
  console.log('');

  try {
    console.log('Testing: extractBehavioralIntelligence()');
    console.log('-'.repeat(70));

    // Store original for purity test
    const original_json = JSON.stringify(mock_canonical);

    // Run extraction
    const start = Date.now();
    const intelligence = extractBehavioralIntelligence(mock_canonical);
    const duration = Date.now() - start;

    console.log(`✓ Extraction completed in ${duration}ms`);

    // Verify purity (no mutation)
    const final_json = JSON.stringify(mock_canonical);
    if (original_json === final_json) {
      console.log('✓ Pure function: canonical unchanged');
    } else {
      console.error('❌ WARNING: Function mutated input!');
      return false;
    }

    // Verify structure
    console.log(`✓ Version: ${intelligence.extraction_version}`);
    console.log(`✓ Profile ID: ${intelligence.profile_id}`);
    console.log(`✓ Extraction time: ${intelligence.extraction_time_ms}ms`);

    // Verify domains
    const domains = intelligence.domains;
    console.log(`✓ Domains: ${Object.keys(domains).length}`);

    // Test Operating System
    console.log('\n[Domain 1: Operating System]');
    const os = domains.operatingSystem;
    if (!os) {
      console.error('❌ Operating System not extracted');
      return false;
    }
    console.log(`  Primary: ${os.primary_driver.dimension} (${os.primary_driver.score})`);
    console.log(`  Secondary: ${os.secondary_stabilizer.dimension} (${os.secondary_stabilizer.score})`);
    console.log(`  Tradeoff: ${os.core_tradeoff.tradeoff}`);
    console.log(`  Summary: ${os.summary.substring(0, 80)}...`);
    console.log(`  Confidence: ${os.confidence}`);

    // Test World Experience
    console.log('\n[Domain 2: World Experience]');
    const we = domains.worldExperience;
    if (!we) {
      console.error('❌ World Experience not extracted');
      return false;
    }
    console.log(`  Perception: Signal ${we.perception_filter.score.toFixed(1)}`);
    console.log(`  Processing: Velocity ${we.information_processing.speed.toFixed(1)} vs Fidelity ${we.information_processing.detail.toFixed(1)}`);
    console.log(`  Time Horizon: ${we.time_horizon.score.toFixed(1)}`);
    console.log(`  Risk: Flex ${we.risk_calibration.flex_score.toFixed(1)} + Vector ${we.risk_calibration.vector_score.toFixed(1)}`);
    console.log(`  Confidence: ${we.confidence}`);

    // Test Others Experience
    console.log('\n[Domain 3: Others Experience]');
    const oe = domains.othersExperience;
    if (!oe) {
      console.error('❌ Others Experience not extracted');
      return false;
    }
    console.log(`  First Impression: ${oe.first_impression.primary_signal}`);
    console.log(`  Communication: ${oe.communication_pattern.clarity_vs_brevity}`);
    console.log(`  Listening: Signal ${oe.listening_pattern.signal_score.toFixed(1)} vs Vector ${oe.listening_pattern.vector_dominance.toFixed(1)}`);
    console.log(`  Trust Speed: ${oe.trust_building_speed.composite.toFixed(1)}/10`);
    console.log(`  Confidence: ${oe.confidence}`);

    // Test Pressure Mechanics
    console.log('\n[Domain 5: Pressure Mechanics]');
    const pm = domains.pressureMechanics;
    if (!pm) {
      console.error('❌ Pressure Mechanics not extracted');
      return false;
    }
    console.log(`  Primary Under Load: ${pm.primary_under_load.dimension}`);
    console.log(`  Normal: ${pm.primary_under_load.normal_state}`);
    console.log(`  Pressure: ${pm.primary_under_load.pressure_state}`);
    console.log(`  Secondary Override: ${pm.secondary_override.dimension}`);
    console.log(`  Confidence: ${pm.confidence}`);

    // Test Contradictions
    console.log('\n[Domain 6: Contradictions]');
    const c = domains.contradictions;
    if (!c) {
      console.error('❌ Contradictions not extracted');
      return false;
    }
    console.log(`  Count: ${c.contradiction_count}`);
    if (c.contradictions.length > 0) {
      console.log(`  First: ${c.contradictions[0].type}`);
      console.log(`  Cost: ${c.contradictions[0].cost}`);
    }
    console.log(`  Confidence: ${c.confidence}`);

    // Verify confidence tiers
    console.log('\n[Confidence Tiers]');
    const tiers = intelligence.confidence_tiers;
    for (const [domain, tier] of Object.entries(tiers)) {
      console.log(`  ${domain}: ${tier}`);
    }

    // Full output sample
    console.log('\n[Sample Full Output - Operating System]');
    console.log(JSON.stringify(os, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('✅ UNIT TEST PASSED');
    console.log('='.repeat(70));

    return true;
  } catch (error) {
    console.error('\n❌ UNIT TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

const success = runUnitTest();
process.exit(success ? 0 : 1);
