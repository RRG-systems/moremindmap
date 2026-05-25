/**
 * executeCanonicalGeneration.js - RESILIENT PROFILE CREATION WITH VAULT
 * 
 * Stage 1.5: Canonical generation, job persistence, and vault save
 * 
 * DESIGN:
 * - Generates profile_id inline (no external deps)
 * - Creates minimal valid canonical dossier
 * - Persists canonical_profile_id to job (critical for next stages)
 * - Attempts vault save (dynamic import, non-blocking on failure)
 * - Handles errors gracefully without blocking pipeline
 */

import { updateJob, JOB_STAGE as MANAGER_JOB_STAGE } from '../miniV2JobManager.js'
import { extractBehavioralIntelligence } from './extractIntelligence.js'
import { refineExtraction } from './extractIntelligenceRefinement.js'

function generateProfileId() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `mm-${year}${month}${day}-${id}`
}

function buildMinimalCanonical(profileInput, jobId) {
  // Extract real dimension scores from profileInput if available
  // profileInput.dimension_scores comes from buildProfileInput() and contains calculated scores
  const dimensionScores = profileInput?.dimension_scores || {}
  
  // Build vector_scores from real data or fallback to neutral defaults (2.5, not 5)
  const vector_scores = {
    vector: dimensionScores.vector?.raw_score ?? 2.5,
    signal: dimensionScores.signal?.raw_score ?? 2.5,
    fidelity: dimensionScores.fidelity?.raw_score ?? 2.5,
    velocity: dimensionScores.velocity?.raw_score ?? 2.5,
    leverage: dimensionScores.leverage?.raw_score ?? 2.5,
    flex: dimensionScores.flex?.raw_score ?? 2.5,
    framework: dimensionScores.framework?.raw_score ?? 2.5,
    horizon: dimensionScores.horizon?.raw_score ?? 2.5
  }
  
  // Build ranked_dimensions from real data
  const ranked_dimensions = Object.entries(vector_scores)
    .map(([dimension, score]) => ({
      dimension,
      score: Math.round(score * 100) / 100,
      rank: dimensionScores[dimension]?.rank ?? 0,
      label: dimensionScores[dimension]?.label,
      confidence: dimensionScores[dimension]?.confidence ?? 0.75
    }))
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map((item, idx) => ({ ...item, rank: idx + 1 }))
  
  // Build top_systems from ranked dimensions
  const top_systems = ranked_dimensions.length > 0 ? {
    primary_driver: ranked_dimensions[0] ? {
      dimension: ranked_dimensions[0].dimension,
      score: ranked_dimensions[0].score,
      rank: 1
    } : { dimension: 'unknown', score: 2.5, rank: 1 },
    secondary_stabilizer: ranked_dimensions[1] ? {
      dimension: ranked_dimensions[1].dimension,
      score: ranked_dimensions[1].score,
      rank: 2
    } : { dimension: 'unknown', score: 2.5, rank: 2 }
  } : {
    primary_driver: { dimension: 'vector', score: 2.5, rank: 1 },
    secondary_stabilizer: { dimension: 'signal', score: 2.5, rank: 2 }
  }
  
  return {
    profile_id: 'will-be-set',
    metadata: {
      assessment_version: 'mini-v2',
      generated_at: new Date().toISOString(),
      model: 'canonical-v1-emergency-inline',
      job_id: jobId,
      generation_mode: 'emergency_inline'
    },
    vector_scores,
    ranked_dimensions,
    top_systems,
    inferred_patterns: { profile_type: 'Profile', operating_signature: 'Emergency Inline' },
    life_direction: { word_count: 0 },
    business_operating_reality: { word_count: 0 },
    growth_tension: { word_count: 0 },
    systems_accountability: { word_count: 0 },
    stall_patterns: { word_count: 0 },
    contradictions: [],
    stress_patterns: {},
    communication_style: {},
    leadership_architecture: {},
    development_targets: [],
    environment_fit: {},
    leadership_readiness: {},
    role_fit_analysis: {},
    future_growth_constraints: {},
    coaching_leverage_points: {},
    hidden_risk_patterns: {},
    execution_identity: {},
    strategic_ceiling_analysis: {},
    evidence_map: {},
    causal_chains: {},
    narrative_profile: {
      profileDNA: 'Emergency inline profile',
      executiveSummary: 'Assessment processed',
      operatingPattern: 'Standard',
      decisionArchitecture: 'Moderate',
      communicationStyle: 'Direct',
      systemUnderStrain: 'Adaptive',
      hiddenContradictions: 'None identified',
      strategicCeiling: 'Unknown',
      coachingLeverage: 'Development focus needed',
      recommendedNextStep: 'Next phase evaluation',
      full_narrative: 'Profile generated in emergency inline mode. Full canonical analysis unavailable due to infrastructure constraints.'
    }
  }
}

const JOB_STAGE = { FIRST_INJECTION: 'first_injection' }

export async function executeCanonicalGeneration(job) {
  const trace = job.diagnostics?.stage_trace || ['ENTER_canonical_generation']
  
  const canonical_diagnostics = {
    attempted: true,
    success: false,
    error: null,
    profile_id: null,
    vault_save_attempted: false,
    vault_save_success: false,
    generation_attempted: true,
    generation_success: false,
    generation_error: null,
    generation_mode: 'emergency_inline',
    generation_time_ms: 0,
    vault_keys_created: [],
    profile_signature: null,
    quality_score: 50,
    job_persisted: false
  }
  
  try {
    const startTime = Date.now()
    
    trace.push('generating_profile_id')
    // Generate profile_id inline
    const profile_id = generateProfileId()
    trace.push(`profile_id_generated: ${profile_id}`)
    
    trace.push('building_canonical_object')
    // Build minimal canonical dossier
    const canonical_profile = buildMinimalCanonical(job.profileInput || {}, job.job_id)
    canonical_profile.profile_id = profile_id
    canonical_profile.metadata.profile_id = profile_id
    
    canonical_diagnostics.generation_success = true
    canonical_diagnostics.generation_time_ms = Date.now() - startTime
    canonical_diagnostics.success = true
    canonical_diagnostics.profile_id = profile_id
    canonical_diagnostics.profile_signature = '5_8'
    
    trace.push('before_job_update')
    
    // CRITICAL: Persist to job so retrieve-profile and WebProfileReport can access it
    await updateJob(job.job_id, {
      canonical_profile_id: profile_id,
      canonical_profile,
      canonical_diagnostics,
      stage: MANAGER_JOB_STAGE.FIRST_INJECTION,
      progress_message: 'Building behavioral profile',
      diagnostics: {
        ...job.diagnostics,
        stage_trace: [...trace, 'canonical_persisted_to_job']
      }
    })
    
    canonical_diagnostics.job_persisted = true
    trace.push('after_job_update_success')
    
    // EXTRACT: Behavioral intelligence from canonical (read-only sibling)
    trace.push('before_behavioral_extraction')
    let behavioral_intelligence = null
    try {
      behavioral_intelligence = extractBehavioralIntelligence(canonical_profile)
      trace.push('behavioral_extraction_success')
      canonical_diagnostics.behavioral_extraction_success = true
      
      // REFINE: Apply quality ascension (emotional realism, causal continuity)
      trace.push('before_behavioral_refinement')
      behavioral_intelligence = refineExtraction(behavioral_intelligence, canonical_profile)
      trace.push('behavioral_refinement_success')
    } catch (extractErr) {
      console.error('[CANONICAL-GENERATION] Behavioral extraction failed:', extractErr.message)
      trace.push(`behavioral_extraction_error: ${extractErr.message}`)
      canonical_diagnostics.behavioral_extraction_success = false
      canonical_diagnostics.behavioral_extraction_error = extractErr.message
    }
    
    // Persist behavioral intelligence alongside canonical (not mutating canonical)
    if (behavioral_intelligence) {
      await updateJob(job.job_id, {
        behavioral_intelligence_v1: behavioral_intelligence,
        diagnostics: {
          ...job.diagnostics,
          stage_trace: [...trace]
        }
      })
      trace.push('behavioral_intelligence_persisted_to_job')
    }
    
    // ATTEMPT: Save canonical to vault for retrieve-profile endpoint
    trace.push('before_vault_save')
    try {
      const { saveCanonicalProfile } = await import('../vault/saveCanonicalProfile.js')
      const vault_result = await saveCanonicalProfile({
        canonical_profile,
        profile_id,
        job_id: job.job_id,
        person_name: job.payload?.metadata?.person_name || job.payload?.metadata?.name || null,
        email: job.payload?.metadata?.email || null,
        company_name: job.payload?.metadata?.organization?.company || job.payload?.metadata?.company_name || null,
        assessment_version: 'mini-v2',
        model: 'canonical-v1-emergency-inline'
      })
      trace.push('after_vault_save_success')
      canonical_diagnostics.vault_save_attempted = true
      canonical_diagnostics.vault_save_success = vault_result.success || false
      if (vault_result.vault_key) canonical_diagnostics.vault_keys_created.push(vault_result.vault_key)
    } catch (vaultErr) {
      console.error('[CANONICAL-GENERATION] Vault save failed (non-blocking):', vaultErr.message)
      trace.push(`vault_save_error: ${vaultErr.message}`)
      canonical_diagnostics.vault_save_attempted = true
      canonical_diagnostics.vault_save_error = vaultErr.message
      // Don't fail pipeline; profile still in job
    }
    
    trace.push('after_vault_attempt')
    
    // Return result for pipeline continuation
    return {
      success: true,
      nextStage: JOB_STAGE.FIRST_INJECTION,
      canonical_profile_id: profile_id,
      canonical_diagnostics,
      canonical_profile
    }
    
  } catch (error) {
    console.error('[CANONICAL-GENERATION] Error:', error.message)
    
    canonical_diagnostics.error = error.message
    canonical_diagnostics.generation_error = error.message
    canonical_diagnostics.success = false
    
    trace.push(`error_caught: ${error.message}`)
    
    // Try to update job with error diagnostics
    try {
      await updateJob(job.job_id, {
        canonical_diagnostics,
        diagnostics: {
          ...job.diagnostics,
          stage_trace: [...trace, 'error_persisted_to_job']
        }
      })
      canonical_diagnostics.job_persisted = true
    } catch (updateErr) {
      console.error('[CANONICAL-GENERATION] Failed to persist error to job:', updateErr.message)
      trace.push(`update_error: ${updateErr.message}`)
    }
    
    // Even on error, attempt vault save if we have a profile_id from diagnostics
    if (canonical_diagnostics.profile_id) {
      try {
        trace.push('attempting_vault_save_after_error')
        const { saveCanonicalProfile } = await import('../vault/saveCanonicalProfile.js')
        // Build minimal canonical for error case
        const errorCanonical = buildMinimalCanonical(job.profileInput || {}, job.job_id)
        errorCanonical.profile_id = canonical_diagnostics.profile_id
        errorCanonical.metadata.profile_id = canonical_diagnostics.profile_id
        await saveCanonicalProfile({
          canonical_profile: errorCanonical,
          profile_id: canonical_diagnostics.profile_id,
          job_id: job.job_id,
          assessment_version: 'mini-v2',
          model: 'canonical-v1-emergency-inline-error-recovery'
        })
        canonical_diagnostics.vault_save_attempted = true
        canonical_diagnostics.vault_save_success = true
      } catch (vaultErr) {
        console.error('[CANONICAL-GENERATION] Vault save after error failed:', vaultErr.message)
        canonical_diagnostics.vault_save_attempted = true
      }
    }
    
    // Continue pipeline despite error (mini-v2 HTML generation may complete)
    return {
      success: true,
      nextStage: JOB_STAGE.FIRST_INJECTION,
      canonical_diagnostics
    }
  }
}
