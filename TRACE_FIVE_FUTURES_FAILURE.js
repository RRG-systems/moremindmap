/**
 * TRACE_FIVE_FUTURES_FAILURE.js
 * 
 * Diagnoses the Five Futures rendering failure.
 * Simulates the data flow from canonical → behavioral_intelligence → renderer
 */

import { generateProfileSpecificFutures } from './api/engine/canonical/generateProfileSpecificFutures.js';

// Mock canonical dossiers (simplified)
const mockDavid = {
  profile_id: 'MM-20260523-mqlev9c9',
  top_systems: {
    primary_driver: {
      dimension: 'vector',
      pressure_manifestation: 'doubles down'
    }
  },
  vector_scores: { vector: 0.86 },
  intake_answers: {
    Q1: 'I move fast and make decisions quickly',
    Q2: 'Sometimes I push too hard'
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
  stall_patterns: { triggers: [] }
};

const mockJonny = {
  profile_id: 'mm-20260527-kgppxg8e',
  top_systems: {
    primary_driver: {
      dimension: 'fidelity',
      pressure_manifestation: 'withdraws'
    }
  },
  vector_scores: { fidelity: 0.75 },
  intake_answers: {
    Q1: 'I focus on precision',
    Q2: 'Sometimes I get stuck on details'
  },
  contradictions: [],
  hidden_risk_patterns: {
    relational_erosion_risk: 'Low',
    burnout_trajectory: 'Medium'
  },
  infrastructure_maturity: {},
  future_ceiling: {
    primary_constraint: 'Perfectionism'
  },
  stall_patterns: { triggers: [] }
};

// Mock normalizer (from extractIntelligence.js)
function normalizeFiveFuturesOutput(futuresArray) {
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

// Mock extractSectionContent
function mockExtractSectionContent(sectionId, behavioralIntelligence) {
  const domain = behavioralIntelligence?.domains?.fiveFutures;
  
  if (!domain) {
    return {
      sectionId,
      found: false,
      error: 'fiveFutures domain not found'
    };
  }
  
  // Extract sourceFields: ['summary', 'futures', 'most_likely']
  const extracted = {
    summary: domain.summary,
    futures: domain.futures,
    most_likely: domain.most_likely
  };
  
  return {
    sectionId,
    found: true,
    source: 'behavioral_intelligence',
    domain: 'fiveFutures',
    content: extracted,
    confidence: 'tier_2_medium',
    fallbackUsed: false
  };
}

// TRACE FUNCTION
function traceProfile(profileName, canonical) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TRACE: ${profileName}`);
  console.log(`${'='.repeat(80)}\n`);
  
  // STEP 1: Generate profile-specific futures
  console.log('[STEP 1] generateProfileSpecificFutures(canonical)');
  const futuresRaw = generateProfileSpecificFutures(canonical);
  console.log(`  typeof: ${typeof futuresRaw}`);
  console.log(`  Array.isArray: ${Array.isArray(futuresRaw)}`);
  console.log(`  length: ${futuresRaw?.length || 'N/A'}`);
  if (Array.isArray(futuresRaw) && futuresRaw.length > 0) {
    console.log(`  First future keys: ${Object.keys(futuresRaw[0]).join(', ')}`);
    console.log(`  First future title: "${futuresRaw[0].title}"`);
    console.log(`  First future has description: ${!!futuresRaw[0].description}`);
    console.log(`  First future has consequence: ${!!futuresRaw[0].consequence}`);
  }
  
  // STEP 2: Normalize output
  console.log(`\n[STEP 2] normalizeFiveFuturesOutput(futuresRaw)`);
  const normalized = normalizeFiveFuturesOutput(futuresRaw);
  console.log(`  typeof: ${typeof normalized}`);
  console.log(`  Object.keys: ${Object.keys(normalized).join(', ')}`);
  console.log(`  normalized.futures type: ${typeof normalized.futures}`);
  console.log(`  normalized.futures.length: ${normalized.futures?.length || 'N/A'}`);
  if (Array.isArray(normalized.futures) && normalized.futures.length > 0) {
    console.log(`  First future keys: ${Object.keys(normalized.futures[0]).join(', ')}`);
    console.log(`  First future has trajectory: ${!!normalized.futures[0].trajectory}`);
    console.log(`  First future has organization_experiences: ${!!normalized.futures[0].organization_experiences}`);
  }
  
  // STEP 3: Build behavioral_intelligence
  console.log(`\n[STEP 3] Build behavioral_intelligence.domains.fiveFutures`);
  const behavioralIntelligence = {
    domains: {
      fiveFutures: normalized
    }
  };
  console.log(`  BI.domains.fiveFutures: ${typeof behavioralIntelligence.domains.fiveFutures}`);
  console.log(`  BI.domains.fiveFutures keys: ${Object.keys(behavioralIntelligence.domains.fiveFutures).join(', ')}`);
  
  // STEP 4: Extract section content (renderer's view)
  console.log(`\n[STEP 4] extractSectionContent('section-five-futures', BI)`);
  const extracted = mockExtractSectionContent('section-five-futures', behavioralIntelligence);
  console.log(`  found: ${extracted.found}`);
  console.log(`  source: ${extracted.source}`);
  if (extracted.found) {
    console.log(`  content keys: ${Object.keys(extracted.content).join(', ')}`);
    console.log(`  content.futures.length: ${extracted.content.futures?.length || 'N/A'}`);
    console.log(`  content.summary: "${extracted.content.summary?.substring(0, 50)}..."`);
  }
  
  // STEP 5: Renderer receives content
  console.log(`\n[STEP 5] FiveFuturesRenderer({ content })`);
  if (extracted.found && extracted.content) {
    const { content } = extracted;
    console.log(`  Array.isArray(content.futures): ${Array.isArray(content.futures)}`);
    console.log(`  content.futures.length > 0: ${(content.futures?.length || 0) > 0}`);
    
    if (Array.isArray(content.futures) && content.futures.length > 0) {
      console.log(`  ✅ WILL RENDER 5 CARDS`);
      content.futures.forEach((f, idx) => {
        const has_title = !!f.title;
        const has_likelihood = !!f.likelihood;
        const has_trajectory = !!f.trajectory;
        const has_org = !!f.organization_experiences;
        const complete = has_title && has_likelihood && has_trajectory && has_org;
        console.log(`    Card ${idx + 1}: "${f.title?.substring(0, 30)}..." complete=${complete} (title=${has_title} likelihood=${has_likelihood} trajectory=${has_trajectory} org=${has_org})`);
      });
    } else {
      console.log(`  ✗ WILL RENDER PLACEHOLDER (futures array is empty or not array)`);
    }
  } else {
    console.log(`  ✗ WILL RENDER PLACEHOLDER (section not found)`);
  }
  
  // SUMMARY
  console.log(`\n[SUMMARY]`);
  if (extracted.found && Array.isArray(extracted.content?.futures) && extracted.content.futures.length === 5) {
    console.log(`  ✅ DATA FLOW IS CORRECT - 5 CARDS SHOULD RENDER`);
  } else {
    console.log(`  ✗ DATA FLOW HAS ISSUE - PLACEHOLDER WILL RENDER`);
  }
}

// RUN TRACES
console.log('\n' + '='.repeat(80));
console.log('FIVE FUTURES RENDERING TRACE');
console.log('='.repeat(80));

traceProfile('David Berg (MM-20260523-mqlev9c9)', mockDavid);
traceProfile('Jonny TOUGHCEO (mm-20260527-kgppxg8e)', mockJonny);

console.log('\n' + '='.repeat(80));
console.log('TRACE COMPLETE');
console.log('='.repeat(80) + '\n');
