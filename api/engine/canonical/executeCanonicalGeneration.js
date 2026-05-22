/**
 * executeCanonicalGeneration.js
 * 
 * Stage 1.5: Canonical generation and Vault storage
 * Generates frontier canonical dossier and saves to Vault
 * 
 * CRITICAL: This stage MUST NOT crash the job pipeline
 * All errors are caught and logged; job continues to FIRST_INJECTION
 */

import { updateJob, JOB_STAGE } from '../miniV2JobManager.js'

export async function executeCanonicalGeneration(job) {
  const trace = job.diagnostics?.stage_trace || []
  trace.push('ENTER_canonical_generation')
  
  const canonical_diagnostics = {
    attempted: true,
    success: false,
    error: null,
    profile_id: null,
    vault_save_attempted: false,
    vault_save_success: false,
    vault_save_error: null,
    timestamp: new Date().toISOString(),
    generation_attempted: true,
    generation_success: false,
    generation_error: null,
    generation_time_ms: 0,
    vault_keys_created: [],
    profile_signature: null,
    quality_score: null
  }
  
  try {
    const start_time = Date.now()
    
    // Import canonical engine
    const { generateCanonicalProfile } = await import('./canonicalProfileGenerator.js')
    const { generateProfileId } = await import('../vault/generateProfileId.js')
    const { saveCanonicalProfile, saveCanonicalMarkdown } = await import('../vault/saveCanonicalProfile.js')
    const { buildNarrativeProfile } = await import('./buildNarrativeProfile.js')
    
    trace.push('imported_canonical_modules')
    
    // Generate canonical profile
    const { profileInput } = job
    
    if (!profileInput) {
      throw new Error('profileInput not available')
    }
    
    trace.push('before_generateCanonicalProfile')
    const canonical_profile = await generateCanonicalProfile(profileInput)
    trace.push('after_generateCanonicalProfile')
    
    canonical_diagnostics.generation_success = true
    canonical_diagnostics.generation_time_ms = Date.now() - start_time
    
    // Generate profile_id
    const profile_id = generateProfileId()
    trace.push(`profile_id_generated: ${profile_id}`)
    
    // Attach profile_id to canonical profile metadata
    canonical_profile.profile_id = profile_id
    canonical_profile.metadata.profile_id = profile_id
    canonical_profile.metadata.job_id = job.job_id
    
    // Extract metadata from job payload
    const { metadata = {} } = job.payload
    const person_name = metadata.person_name || metadata.name || null
    const email = metadata.email || null
    const company_name = metadata.company_name || metadata.company || null
    
    // Calculate quality score (if available from canonical profile)
    const quality_score = canonical_profile.evidence_map?.aggregate_confidence 
      ? Math.round(canonical_profile.evidence_map.aggregate_confidence * 100)
      : null
    
    canonical_diagnostics.quality_score = quality_score
    canonical_diagnostics.profile_signature = canonical_profile.vector_scores 
      ? `${canonical_profile.vector_scores.vector}_${canonical_profile.vector_scores.signal}`
      : null
    
    // Generate markdown
    trace.push('before_buildNarrativeProfile')
    const narrative = buildNarrativeProfile(canonical_profile)
    const canonical_markdown = narrative.full_narrative || null
    trace.push('after_buildNarrativeProfile')
    
    // Save to Vault
    canonical_diagnostics.vault_save_attempted = true
    trace.push('before_saveCanonicalProfile')
    
    const vault_result = await saveCanonicalProfile({
      canonical_profile,
      job_id: job.job_id,
      person_name,
      email,
      company_name,
      assessment_version: 'mini-v2',
      model: 'canonical-v1-frontier',
      intake_answers: job.payload.answers,
      quality_score,
      metadata: {
        ...metadata,
        generation_time_ms: canonical_diagnostics.generation_time_ms,
        job_created_at: job.created_at
      }
    })
    
    trace.push('after_saveCanonicalProfile')
    
    canonical_diagnostics.vault_save_success = vault_result.success
    canonical_diagnostics.success = true
    canonical_diagnostics.profile_id = profile_id
    canonical_diagnostics.vault_keys_created.push(vault_result.vault_key)
    
    // Save markdown
    if (canonical_markdown) {
      trace.push('before_saveCanonicalMarkdown')
      const md_result = await saveCanonicalMarkdown(profile_id, canonical_markdown)
      trace.push('after_saveCanonicalMarkdown')
      
      if (md_result.success) {
        canonical_diagnostics.vault_keys_created.push(md_result.markdown_key)
      }
    }
    
    // Update job with canonical data
    await updateJob(job.job_id, {
      stage: JOB_STAGE.FIRST_INJECTION,
      progress_message: 'Building behavioral profile',
      canonical_profile_id: profile_id,
      canonical_company_name: company_name,
      canonical_profile,
      canonical_profile_markdown: canonical_markdown,
      canonical_diagnostics,
      diagnostics: {
        ...job.diagnostics,
        stage_trace: [...trace, 'canonical_generation_complete']
      }
    })
    
    trace.push('EXIT_canonical_generation')
    return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
    
  } catch (error) {
    // Log error but DO NOT fail job
    console.error('[CANONICAL-GENERATION] Error:', error)
    
    // Extract stack trace info for debugging
    const stackLines = error.stack ? error.stack.split('\n').slice(1, 4) : []
    const stackSummary = stackLines.join(' | ').substring(0, 200)
    
    canonical_diagnostics.error = error.message
    canonical_diagnostics.generation_error = error.message
    canonical_diagnostics.generation_error_stack = stackSummary
    if (canonical_diagnostics.vault_save_attempted && !canonical_diagnostics.vault_save_success) {
      canonical_diagnostics.vault_save_error = error.message
    }
    
    // Update job with error diagnostics, continue to next stage
    await updateJob(job.job_id, {
      stage: JOB_STAGE.FIRST_INJECTION,
      progress_message: 'Building behavioral profile',
      canonical_diagnostics,
      diagnostics: {
        ...job.diagnostics,
        stage_trace: [...trace, `canonical_generation_error: ${error.message}`],
        canonical_generation_failed: true
      }
    })
    
    // Return success to continue pipeline
    return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
  }
}
