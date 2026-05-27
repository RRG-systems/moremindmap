/**
 * TEST_NORMALIZER_ERROR.js
 * 
 * Tests if the normalizer could throw an error that gets caught
 */

import { generateProfileSpecificFutures } from './api/engine/canonical/generateProfileSpecificFutures.js';

function normalizeFiveFuturesOutput(futuresArray) {
  console.log('[NORMALIZER] Input:', {
    typeof: typeof futuresArray,
    isArray: Array.isArray(futuresArray),
    length: futuresArray?.length,
    firstItem: futuresArray?.[0] ? { title: futuresArray[0].title, keys: Object.keys(futuresArray[0]) } : null
  });
  
  if (!Array.isArray(futuresArray) || futuresArray.length === 0) {
    return {
      futures: [],
      summary: 'Future trajectory analysis not available.',
      most_likely: null
    };
  }
  
  // Map engine fields to renderer schema
  console.log('[NORMALIZER] Mapping', futuresArray.length, 'futures...');
  
  try {
    const normalized = futuresArray.map((future, idx) => {
      console.log(`  [NORMALIZER] Mapping future ${idx}...`);
      const mapped = {
        title: future.title,
        likelihood: future.likelihood,
        trajectory: future.description,
        organization_experiences: future.consequence,
        profile_specific: future.profile_specific
      };
      console.log(`  [NORMALIZER] Future ${idx} mapped:`, {
        title: mapped.title,
        likelihood: mapped.likelihood,
        trajectory_length: mapped.trajectory?.length,
        org_experiences_length: mapped.organization_experiences?.length,
        has_all_fields: mapped.title && mapped.likelihood && mapped.trajectory && mapped.organization_experiences
      });
      return mapped;
    });
    
    console.log('[NORMALIZER] All futures mapped successfully');
    
    const result = {
      futures: normalized,
      summary: 'Five trajectory scenarios emerge from your current operating pattern.',
      most_likely: normalized[0] || null
    };
    
    console.log('[NORMALIZER] Result:', {
      futures_length: result.futures.length,
      summary_length: result.summary.length,
      most_likely: result.most_likely ? { title: result.most_likely.title } : null
    });
    
    return result;
  } catch (error) {
    console.error('[NORMALIZER ERROR]', error);
    throw error;
  }
}

// Test with mock data
const mockCanonical = {
  profile_id: 'MM-20260523-mqlev9c9',
  top_systems: {
    primary_driver: {
      dimension: 'vector',
      pressure_manifestation: 'doubles down'
    }
  },
  vector_scores: { vector: 0.86 },
  intake_answers: {
    Q1: 'I move fast',
    Q2: 'I push hard'
  },
  contradictions: [],
  hidden_risk_patterns: {
    relational_erosion_risk: 'Medium',
    burnout_trajectory: 'Low'
  },
  infrastructure_maturity: {},
  future_ceiling: { primary_constraint: 'Team capacity' },
  stall_patterns: { triggers: [] }
};

console.log('\n' + '='.repeat(80));
console.log('TEST: NORMALIZER ERROR HANDLING');
console.log('='.repeat(80) + '\n');

try {
  console.log('[TEST] Calling generateProfileSpecificFutures...');
  const futuresRaw = generateProfileSpecificFutures(mockCanonical);
  console.log('[TEST] generateProfileSpecificFutures returned:', {
    type: typeof futuresRaw,
    isArray: Array.isArray(futuresRaw),
    length: futuresRaw?.length
  });
  
  console.log('\n[TEST] Calling normalizeFiveFuturesOutput...');
  const normalized = normalizeFiveFuturesOutput(futuresRaw);
  console.log('\n[TEST] normalizeFiveFuturesOutput returned:', {
    type: typeof normalized,
    keys: Object.keys(normalized),
    futures_count: normalized.futures?.length
  });
  
  console.log('\n✅ NO ERRORS - NORMALIZER WORKS');
} catch (error) {
  console.error('\n✗ ERROR CAUGHT:');
  console.error('  Message:', error.message);
  console.error('  Stack:', error.stack);
}

console.log('\n' + '='.repeat(80) + '\n');
