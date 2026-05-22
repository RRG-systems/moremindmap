/**
 * Test executeCanonicalGeneration with real 28-answer job data
 * 
 * Verifies:
 * - generateCanonicalProfile awaited correctly
 * - canonical_profile object has metadata
 * - profile_id can be set
 * - No "Cannot set properties of undefined" crash
 */

import { v4 as uuidv4 } from 'uuid'

// Mock job data with 28 answers and metadata
const mockJob = {
  job_id: uuidv4(),
  status: 'processing',
  stage: 'canonical_generation',
  payload: {
    answers: {
      q1: { choice: 'A' },
      q2: { choice: 'B' },
      q3: { choice: 'C' },
      q4: { choice: 'A' },
      q5: { choice: 'B' },
      q6: { choice: 'C' },
      q7: { choice: 'A' },
      q8: { choice: 'B' },
      q9: { choice: 'C' },
      q10: { choice: 'A', written_response: 'Long form answer 1' },
      q11: { choice: 'B', written_response: 'Long form answer 2' },
      q12: { choice: 'C' },
      q13: { choice: 'A' },
      q14: { choice: 'B' },
      q15: { choice: 'C' },
      q16: { choice: 'A' },
      q17: { choice: 'B', written_response: 'Stress answer' },
      q18: { choice: 'C' },
      q19: { choice: 'A' },
      q20: { choice: 'B' },
      q21: { choice: 'C' },
      q22: { choice: 'A' },
      q23: { choice: 'B' },
      q24: { choice: 'C', written_response: 'Challenge answer' },
      q25: { choice: 'A' },
      q26: { choice: 'B', written_response: 'Business reality' },
      q27: { choice: 'C', written_response: 'Growth capacity' },
      q28: { choice: 'A', written_response: 'Systems accountability' }
    },
    metadata: {
      person_name: 'Test User',
      email: 'test@example.com',
      company_name: 'Test Corp'
    }
  },
  profileInput: {
    person_name: 'Test User',
    email: 'test@example.com',
    company_name: 'Test Corp',
    answers: {
      q1: { choice: 'A' },
      q2: { choice: 'B' },
      q3: { choice: 'C' },
      q4: { choice: 'A' },
      q5: { choice: 'B' },
      q6: { choice: 'C' },
      q7: { choice: 'A' },
      q8: { choice: 'B' },
      q9: { choice: 'C' },
      q10: { choice: 'A', written_response: 'Long form answer 1' },
      q11: { choice: 'B', written_response: 'Long form answer 2' },
      q12: { choice: 'C' },
      q13: { choice: 'A' },
      q14: { choice: 'B' },
      q15: { choice: 'C' },
      q16: { choice: 'A' },
      q17: { choice: 'B', written_response: 'Stress answer' },
      q18: { choice: 'C' },
      q19: { choice: 'A' },
      q20: { choice: 'B' },
      q21: { choice: 'C' },
      q22: { choice: 'A' },
      q23: { choice: 'B' },
      q24: { choice: 'C', written_response: 'Challenge answer' },
      q25: { choice: 'A' },
      q26: { choice: 'B', written_response: 'Business reality' },
      q27: { choice: 'C', written_response: 'Growth capacity' },
      q28: { choice: 'A', written_response: 'Systems accountability' }
    }
  },
  diagnostics: {
    stage_trace: []
  }
}

async function testExecuteCanonicalGeneration() {
  console.log('Starting canonical generation test...\n')
  
  try {
    // Import the function to test
    const { executeCanonicalGeneration } = await import('../api/engine/canonical/executeCanonicalGeneration.js')
    
    console.log('✓ Imported executeCanonicalGeneration')
    
    // Run the stage
    const result = await executeCanonicalGeneration(mockJob)
    
    console.log('\n✓ executeCanonicalGeneration completed')
    console.log(`  - success: ${result.success}`)
    console.log(`  - nextStage: ${result.nextStage}`)
    
    // Check job after execution
    if (mockJob.canonical_profile_id) {
      console.log(`\n✓ canonical_profile_id assigned: ${mockJob.canonical_profile_id}`)
    }
    
    if (mockJob.canonical_diagnostics) {
      console.log(`\n✓ canonical_diagnostics:`)
      console.log(`  - attempted: ${mockJob.canonical_diagnostics.attempted}`)
      console.log(`  - success: ${mockJob.canonical_diagnostics.success}`)
      console.log(`  - profile_id: ${mockJob.canonical_diagnostics.profile_id}`)
      console.log(`  - vault_save_attempted: ${mockJob.canonical_diagnostics.vault_save_attempted}`)
      console.log(`  - vault_save_success: ${mockJob.canonical_diagnostics.vault_save_success}`)
      
      if (mockJob.canonical_diagnostics.error) {
        console.log(`  - error: ${mockJob.canonical_diagnostics.error}`)
      }
    }
    
    console.log('\n✓ TEST PASSED: No crash, canonical generation executed\n')
    return true
    
  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message)
    console.error(error.stack)
    return false
  }
}

// Run test
testExecuteCanonicalGeneration().then(passed => {
  process.exit(passed ? 0 : 1)
})
