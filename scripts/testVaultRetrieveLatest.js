/**
 * testVaultRetrieveLatest.js
 * 
 * Test retrieval of latest Vault profiles
 * Confirms canonical JSON exists, markdown exists, and profile_id works
 */

import { listRecentProfiles, getVaultStats } from '../api/engine/vault/listCanonicalProfiles.js'
import { getCanonicalProfile, getCanonicalMarkdown } from '../api/engine/vault/getCanonicalProfile.js'

async function testRetrieveLatest() {
  console.log('[VAULT RETRIEVE TEST] Starting...\n')
  
  try {
    // STEP 1: Get Vault stats
    console.log('[STEP 1] Getting Vault statistics...')
    const stats = await getVaultStats()
    
    console.log('[STEP 1] ✓ Vault stats retrieved')
    console.log(`[STEP 1]   total_profiles: ${stats.total_profiles}`)
    console.log(`[STEP 1]   dates_with_profiles: ${stats.dates_with_profiles}`)
    console.log(`[STEP 1]   unique_emails: ${stats.unique_emails}`)
    console.log(`[STEP 1]   earliest_date: ${stats.earliest_date}`)
    console.log(`[STEP 1]   latest_date: ${stats.latest_date}\n`)
    
    if (stats.total_profiles === 0) {
      console.log('[WARNING] No profiles in Vault yet. Run a live assessment first.\n')
      return { success: true, profiles_found: 0 }
    }
    
    // STEP 2: List recent profiles
    console.log('[STEP 2] Listing recent profiles...')
    const recent = await listRecentProfiles(5)
    
    console.log('[STEP 2] ✓ Recent profiles listed')
    console.log(`[STEP 2]   count: ${recent.count}`)
    console.log(`[STEP 2]   total_available: ${recent.total_available}\n`)
    
    if (recent.count === 0) {
      console.log('[WARNING] No recent profiles found.\n')
      return { success: true, profiles_found: 0 }
    }
    
    // STEP 3: Show latest profiles
    console.log('[STEP 3] Latest profiles:')
    recent.profiles.forEach((p, idx) => {
      console.log(`[STEP 3]   ${idx + 1}. ${p.profile_id}`)
      console.log(`[STEP 3]      person_name: ${p.person_name || '(not set)'}`)
      console.log(`[STEP 3]      email: ${p.email || '(not set)'}`)
      console.log(`[STEP 3]      created_at: ${p.created_at}`)
      console.log(`[STEP 3]      quality_score: ${p.quality_score || 'N/A'}`)
      console.log(`[STEP 3]      model: ${p.model}`)
      console.log('')
    })
    
    // STEP 4: Retrieve latest profile
    const latest_id = recent.profiles[0].profile_id
    console.log(`[STEP 4] Retrieving latest profile: ${latest_id}...`)
    
    const profile = await getCanonicalProfile(latest_id)
    
    if (!profile.found) {
      console.log('[STEP 4] ✗ Profile not found\n')
      return { success: false, error: 'Latest profile not retrievable' }
    }
    
    console.log('[STEP 4] ✓ Profile retrieved')
    console.log(`[STEP 4]   profile_id: ${profile.profile_id}`)
    console.log(`[STEP 4]   person_name: ${profile.person_name || '(not set)'}`)
    console.log(`[STEP 4]   email: ${profile.email || '(not set)'}`)
    console.log(`[STEP 4]   job_id: ${profile.job_id || 'N/A'}`)
    console.log(`[STEP 4]   quality_score: ${profile.quality_score || 'N/A'}`)
    console.log(`[STEP 4]   model: ${profile.model}`)
    console.log(`[STEP 4]   profile_signature: ${profile.profile_signature}`)
    console.log(`[STEP 4]   created_at: ${profile.created_at}`)
    
    // Check canonical_profile_json structure
    const has_canonical = !!profile.canonical_profile_json
    const has_vector_scores = !!profile.vector_scores
    const has_evidence_map = !!profile.canonical_profile_json?.evidence_map
    const has_causal_chains = !!profile.canonical_profile_json?.causal_chains
    
    console.log(`[STEP 4]   canonical_profile_json: ${has_canonical ? 'YES' : 'NO'}`)
    console.log(`[STEP 4]   vector_scores: ${has_vector_scores ? 'YES' : 'NO'}`)
    console.log(`[STEP 4]   evidence_map: ${has_evidence_map ? 'YES' : 'NO'}`)
    console.log(`[STEP 4]   causal_chains: ${has_causal_chains ? 'YES' : 'NO'}\n`)
    
    // STEP 5: Retrieve markdown
    console.log(`[STEP 5] Retrieving markdown for: ${latest_id}...`)
    
    const markdown = await getCanonicalMarkdown(latest_id)
    
    if (!markdown.found) {
      console.log('[STEP 5] ✗ Markdown not found\n')
    } else {
      console.log('[STEP 5] ✓ Markdown retrieved')
      console.log(`[STEP 5]   markdown_size: ${markdown.markdown_size} bytes`)
      console.log(`[STEP 5]   first_100_chars: ${markdown.markdown.substring(0, 100)}...\n`)
    }
    
    // STEP 6: Summary
    console.log('═══════════════════════════════════════════════════════════')
    console.log('VAULT RETRIEVE TEST RESULTS')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`✓ Vault stats:              ${stats.total_profiles} profiles`)
    console.log(`✓ Recent profiles listed:   ${recent.count} profiles`)
    console.log(`✓ Latest profile_id:        ${latest_id}`)
    console.log(`✓ Profile retrieved:        ${profile.found ? 'YES' : 'NO'}`)
    console.log(`✓ Canonical JSON exists:    ${has_canonical ? 'YES' : 'NO'}`)
    console.log(`✓ Evidence map exists:      ${has_evidence_map ? 'YES' : 'NO'}`)
    console.log(`✓ Causal chains exist:      ${has_causal_chains ? 'YES' : 'NO'}`)
    console.log(`✓ Markdown retrieved:       ${markdown.found ? 'YES' : 'NO'}`)
    console.log(`✓ Quality score:            ${profile.quality_score || 'N/A'}`)
    console.log('═══════════════════════════════════════════════════════════\n')
    
    return {
      success: true,
      profiles_found: recent.count,
      latest_profile_id: latest_id,
      canonical_exists: has_canonical,
      markdown_exists: markdown.found,
      quality_score: profile.quality_score
    }
    
  } catch (error) {
    console.error('[ERROR] Vault retrieve test failed:', error)
    console.error('[ERROR] Stack:', error.stack)
    return { success: false, error: error.message }
  }
}

// Run test
testRetrieveLatest()
  .then(result => {
    if (result.success) {
      console.log('[SUCCESS] Vault retrieval test complete')
      process.exit(0)
    } else {
      console.log('[FAILURE] Vault retrieval test failed')
      process.exit(1)
    }
  })
  .catch(err => {
    console.error('[FATAL] Unhandled error:', err)
    process.exit(1)
  })
