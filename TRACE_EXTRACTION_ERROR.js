/**
 * TRACE_EXTRACTION_ERROR.js
 * 
 * Simulates extractBehavioralIntelligence with detailed error logging
 */

import { generateProfileSpecificFutures } from './api/engine/canonical/generateProfileSpecificFutures.js';

function normalizeFiveFuturesOutput(futuresArray) {
  console.log('[NORMALIZE] Called with:', { type: typeof futuresArray, isArray: Array.isArray(futuresArray), length: futuresArray?.length });
  
  if (!Array.isArray(futuresArray) || futuresArray.length === 0) {
    return {
      futures: [],
      summary: 'Future trajectory analysis not available.',
      most_likely: null
    };
  }
  
  const normalized = futuresArray.map(future => ({
    title: future.title,
    likelihood: future.likelihood,
    trajectory: future.description,
    organization_experiences: future.consequence,
    profile_specific: future.profile_specific
  }));
  
  return {
    futures: normalized,
    summary: 'Five trajectory scenarios emerge from your current operating pattern.',
    most_likely: normalized[0] || null
  };
}

function simulateExtractBehavioralIntelligence(canonical_profile) {
  console.log('\n[EXTRACT] Called extractBehavioralIntelligence');
  
  if (!canonical_profile) {
    console.log('[EXTRACT] canonical_profile is null');
    return { domains: {} };
  }

  const canonical = canonical_profile.canonical_profile_json || canonical_profile;
  
  try {
    console.log('[EXTRACT] Creating intelligence object...');
    
    // This is the line that could fail
    console.log('[EXTRACT] Calling generateProfileSpecificFutures...');
    const futuresRaw = generateProfileSpecificFutures(canonical);
    console.log('[EXTRACT] generateProfileSpecificFutures returned:', { type: typeof futuresRaw, isArray: Array.isArray(futuresRaw), length: futuresRaw?.length });
    
    console.log('[EXTRACT] Calling normalizeFiveFuturesOutput...');
    const fiveFuturesNormalized = normalizeFiveFuturesOutput(futuresRaw);
    console.log('[EXTRACT] normalizeFiveFuturesOutput returned:', { type: typeof fiveFuturesNormalized, keys: Object.keys(fiveFuturesNormalized) });
    
    const intelligence = {
      extraction_version: 'v1.0.0-tier1',
      domains: {
        fiveFutures: fiveFuturesNormalized
      }
    };
    
    console.log('[EXTRACT] ✅ Intelligence object created successfully');
    console.log('[EXTRACT] intelligence.domains.fiveFutures:', { 
      type: typeof intelligence.domains.fiveFutures,
      keys: Object.keys(intelligence.domains.fiveFutures || {}),
      futures_count: intelligence.domains.fiveFutures?.futures?.length
    });
    
    return intelligence;
  } catch (error) {
    console.error('[EXTRACT] ✗ ERROR CAUGHT:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    console.log('[EXTRACT] Returning empty intelligence (behavioral_intelligence_v1 will be null)');
    return { domains: {} };
  }
}

// Mock canonical
const mockCanonical = {
  profile_id: 'MM-20260523-mqlev9c9',
  top_systems: {
    primary_driver: {
      dimension: 'vector',
      pressure_manifestation: 'doubles down'
    }
  },
  vector_scores: { vector: 0.86 },
  intake_answers: { Q1: 'I move fast' },
  contradictions: [],
  hidden_risk_patterns: { relational_erosion_risk: 'Medium' },
  infrastructure_maturity: {},
  future_ceiling: { primary_constraint: 'Team capacity' },
  stall_patterns: { triggers: [] }
};

console.log('\n' + '='.repeat(80));
console.log('TRACE: extractBehavioralIntelligence with Error Handling');
console.log('='.repeat(80));

const result = simulateExtractBehavioralIntelligence(mockCanonical);

console.log('\n[RESULT] Final intelligence object:');
console.log('  domains keys:', Object.keys(result.domains));
console.log('  domains.fiveFutures:', result.domains.fiveFutures ? '✓ exists' : '✗ missing');
if (result.domains.fiveFutures) {
  console.log('  domains.fiveFutures keys:', Object.keys(result.domains.fiveFutures));
  console.log('  domains.fiveFutures.futures length:', result.domains.fiveFutures.futures?.length);
}

console.log('\n' + '='.repeat(80) + '\n');
