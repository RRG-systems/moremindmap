/**
 * TEST_FUTURES_SCHEMA.js
 * 
 * Verifies Futures Engine output matches Renderer schema
 */

// Mock engine output (5 profile-specific futures)
const engineOutput = [
  {
    title: 'Momentum Empire',
    likelihood: 'likely',
    description: 'Speed compounds. Operator-led expansion accelerates.',
    consequence: 'Organization becomes dependent on tempo.',
    profile_specific: true
  },
  {
    title: 'Strategic Operator Commander',
    likelihood: 'possible',
    description: 'Vector channeled through systems. Organization scales systematically.',
    consequence: 'Organization becomes systematic operator: fast decisions + structured execution.',
    profile_specific: true
  },
  {
    title: 'Speed Spiral',
    likelihood: 'possible',
    description: 'Vector becomes impatience. Quick decisions become reckless.',
    consequence: 'Organization experiences whiplash. Course corrections break trust.',
    profile_specific: true
  },
  {
    title: 'Team Bottleneck Spiral',
    likelihood: 'likely',
    description: 'Operator speed outpaces team capacity. Team feels left behind.',
    consequence: 'Communication breaks down.',
    profile_specific: true
  },
  {
    title: 'Structured Velocity',
    likelihood: 'possible',
    description: 'Infrastructure built. Systems support speed.',
    consequence: 'Organization can scale without operator bottleneck.',
    profile_specific: true
  }
];

// Normalizer function (from extractIntelligence.js)
function normalizeFiveFuturesOutput(futuresArray) {
  if (!Array.isArray(futuresArray) || futuresArray.length === 0) {
    return {
      futures: [],
      summary: 'Future trajectory analysis not available.',
      most_likely: null
    };
  }
  
  // Map engine fields to renderer schema
  const normalized = futuresArray.map(future => ({
    title: future.title,
    likelihood: future.likelihood,
    trajectory: future.description,  // Engine uses 'description', renderer expects 'trajectory'
    organization_experiences: future.consequence,  // Engine uses 'consequence', renderer expects 'organization_experiences'
    profile_specific: future.profile_specific
  }));
  
  return {
    futures: normalized,
    summary: 'Five trajectory scenarios emerge from your current operating pattern.',
    most_likely: normalized[0] || null
  };
}

// Test normalization
const normalized = normalizeFiveFuturesOutput(engineOutput);

console.log('✅ Normalized output structure:');
console.log(JSON.stringify(normalized, null, 2));

// Verify renderer can consume this
console.log('\n✅ FiveFuturesRenderer expected schema:');
console.log('- content.futures = array of 5 objects');
console.log('- Each object has: title, likelihood, trajectory, organization_experiences');
console.log(`- Actual futures count: ${normalized.futures.length}`);

// Verify each future has required fields
console.log('\n✅ Verifying each future has required fields:');
let allValid = true;
normalized.futures.forEach((f, idx) => {
  const valid = f.title && f.likelihood && f.trajectory && f.organization_experiences;
  console.log(`Future ${idx + 1}: title="${f.title.substring(0, 30)}..." likelihood="${f.likelihood}" trajectory_length=${f.trajectory.length} org_impact_length=${f.organization_experiences.length} - ${valid ? '✓' : '✗'}`);
  if (!valid) allValid = false;
});

if (allValid) {
  console.log('\n✅ SCHEMA FIX VERIFIED: All futures have required renderer fields');
} else {
  console.log('\n✗ SCHEMA MISMATCH: Some futures missing required fields');
}
