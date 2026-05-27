/**
 * TEST_EXTRACT_DOMAINS.js
 * 
 * Runs extractBehavioralIntelligence against mock profiles
 * to identify which domain extractor is failing
 */

import { extractBehavioralIntelligence } from './api/engine/canonical/extractIntelligence.js';

// Mock canonical dossiers with realistic data
const profiles = {
  david: {
    profile_id: 'MM-20260523-mqlev9c9',
    top_systems: {
      primary_driver: {
        dimension: 'vector',
        score: 0.86,
        rank: 1,
        pressure_manifestation: 'doubles down'
      },
      secondary_stabilizer: {
        dimension: 'signal',
        score: 0.65
      }
    },
    vector_scores: {
      vector: 0.86,
      velocity: 0.70,
      signal: 0.60,
      flex: -0.50
    },
    intake_answers: {
      Q1: 'I move fast',
      Q2: 'I make decisions quickly'
    },
    contradictions: [],
    hidden_risk_patterns: {
      relational_erosion_risk: 'Medium',
      burnout_trajectory: 'Low'
    },
    infrastructure_maturity: {},
    future_ceiling: {
      primary_constraint: 'Team capacity'
    },
    stall_patterns: { triggers: [] },
    top_dimensions: [
      { dimension: 'vector', score: 0.86 }
    ]
  },
  pamela: {
    profile_id: 'mm-20260526-r8362esx',
    top_systems: {
      primary_driver: {
        dimension: 'signal',
        score: 0.72,
        pressure_manifestation: 'adapts'
      }
    },
    vector_scores: {
      vector: 0.45,
      signal: 0.72,
      fidelity: 0.55
    },
    intake_answers: {
      Q1: 'I observe patterns',
      Q2: 'I adapt to changes'
    },
    contradictions: [],
    hidden_risk_patterns: { relational_erosion_risk: 'Low' },
    infrastructure_maturity: {},
    future_ceiling: {},
    stall_patterns: { triggers: [] },
    top_dimensions: []
  },
  jonny: {
    profile_id: 'mm-20260527-kgppxg8e',
    top_systems: {
      primary_driver: {
        dimension: 'fidelity',
        score: 0.75,
        pressure_manifestation: 'withdraws'
      }
    },
    vector_scores: {
      fidelity: 0.75,
      vector: 0.30,
      signal: 0.40
    },
    intake_answers: {
      Q1: 'I focus on precision',
      Q2: 'I get stuck on details'
    },
    contradictions: [],
    hidden_risk_patterns: { burnout_trajectory: 'Medium' },
    infrastructure_maturity: {},
    future_ceiling: { primary_constraint: 'Perfectionism' },
    stall_patterns: { triggers: ['decision'] },
    top_dimensions: []
  }
};

console.log('\n' + '='.repeat(80));
console.log('TEST: Domain-level extraction for all profiles');
console.log('='.repeat(80) + '\n');

for (const [name, canonical] of Object.entries(profiles)) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`PROFILE: ${name.toUpperCase()}`);
  console.log(`Profile ID: ${canonical.profile_id}`);
  console.log(`${'─'.repeat(80)}\n`);
  
  try {
    console.log('[TEST] Calling extractBehavioralIntelligence...\n');
    const result = extractBehavioralIntelligence(canonical);
    
    if (result && result.domains) {
      console.log(`\n✅ SUCCESS: All domains extracted`);
      console.log(`  Domains present: ${Object.keys(result.domains).join(', ')}`);
      console.log(`  fiveFutures present: ${!!result.domains.fiveFutures}`);
      if (result.domains.fiveFutures) {
        console.log(`  fiveFutures.futures length: ${result.domains.fiveFutures.futures?.length}`);
      }
    } else {
      console.log(`\n✗ FAILED: extractBehavioralIntelligence returned empty or null`);
    }
  } catch (error) {
    console.error(`\n✗ EXCEPTION THROWN:`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Stack (first 3 lines):`);
    error.stack?.split('\n').slice(0, 3).forEach(line => {
      console.error(`    ${line}`);
    });
  }
}

console.log(`\n${'='.repeat(80)}\n`);
