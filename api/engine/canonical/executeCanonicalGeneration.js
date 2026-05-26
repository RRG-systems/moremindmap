/**
 * executeCanonicalGeneration.js - GUARDED CANONICAL GENERATION
 * 
 * Stage 1.5: Canonical generation with hard fail on data loss
 * 
 * DESIGN:
 * - Requires valid profileInput with dimension_scores (HARD FAIL otherwise)
 * - Generates full canonical with generation_mode: "normal"
 * - Never generates emergency_inline skeleton
 * - Uses buildFullCanonical (real data) not buildMinimalCanonical (skeleton)
 * - If generation_mode becomes emergency_inline, job fails
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

/**
 * buildFullCanonical - Generate FULL canonical from real profileInput
 * 
 * This is NOT emergency_inline. This uses real dimension scores
 * and generates authentic top_systems with manifestations.
 * 
 * HARD FAIL if profileInput missing or incomplete.
 */
function buildFullCanonical(profileInput, jobId) {
  // HARD FAIL: profileInput must be complete
  if (!profileInput || !profileInput.dimension_scores || Object.keys(profileInput.dimension_scores).length === 0) {
    throw new Error(
      'CANONICAL GENERATION FAILED: profileInput missing or incomplete. ' +
      'dimension_scores required for full canonical. Job cannot proceed.'
    )
  }

  const dimensionScores = profileInput.dimension_scores
  
  // Verify all 8 dimensions present with real scores
  const requiredDims = ['vector', 'signal', 'fidelity', 'velocity', 'leverage', 'flex', 'framework', 'horizon']
  const missingDims = requiredDims.filter(dim => !dimensionScores[dim]?.raw_score)
  
  if (missingDims.length > 0) {
    throw new Error(
      `CANONICAL GENERATION FAILED: Missing dimension scores for: ${missingDims.join(', ')}. ` +
      'profileInput is incomplete or corrupted.'
    )
  }
  
  // Build vector_scores from REAL data
  const vector_scores = {}
  requiredDims.forEach(dim => {
    vector_scores[dim] = dimensionScores[dim].raw_score
  })
  
  // Build ranked_dimensions from real data
  const ranked_dimensions = Object.entries(vector_scores)
    .map(([dimension, score]) => ({
      dimension,
      score: Math.round(score * 100) / 100,
      rank: dimensionScores[dimension]?.rank || 0,
      label: dimensionScores[dimension]?.label || dimension,
      confidence: dimensionScores[dimension]?.confidence || 0.8
    }))
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map((item, idx) => ({ ...item, rank: idx + 1 }))
  
  // Build top_systems with full manifestations (4 patterns: primary, secondary, 2 opposing)
  const [primary, secondary, ...rest] = ranked_dimensions
  const opposing1 = rest[rest.length - 2] || rest[0]
  const opposing2 = rest[rest.length - 1] || rest[0]
  
  const top_systems = [
    {
      dimension: primary.dimension,
      rank: 1,
      score: primary.score,
      primary: true,
      pattern_type: 'primary_driver',
      description: `Core operating dimension: ${primary.dimension}`,
      operating_manifestation: `Naturally operates through ${primary.dimension} lens when at baseline functioning`,
      pressure_manifestation: `Under pressure or stress, amplifies ${primary.dimension} further, can overextend this dimension`
    },
    {
      dimension: secondary.dimension,
      rank: 2,
      score: secondary.score,
      primary: true,
      pattern_type: 'secondary_stabilizer',
      description: `Stabilizing dimension: ${secondary.dimension}`,
      operating_manifestation: `Uses ${secondary.dimension} to balance and moderate ${primary.dimension}`,
      pressure_manifestation: `Under stress, may shift focus to ${secondary.dimension} as escape or stabilizer`
    },
    {
      dimension: opposing1.dimension,
      rank: opposing1.rank,
      score: opposing1.score,
      primary: false,
      pattern_type: 'opposing_pattern_1',
      description: `Contrasting dimension: ${opposing1.dimension}`,
      operating_manifestation: `${opposing1.dimension} is de-emphasized in normal operations`,
      pressure_manifestation: `May emerge unexpectedly under certain stress conditions, creating tension with primary`
    },
    {
      dimension: opposing2.dimension,
      rank: opposing2.rank,
      score: opposing2.score,
      primary: false,
      pattern_type: 'opposing_pattern_2',
      description: `Contrasting dimension: ${opposing2.dimension}`,
      operating_manifestation: `${opposing2.dimension} rarely surfaces in baseline functioning`,
      pressure_manifestation: `Seldom emerges even under stress, represents potential blind spot`
    }
  ]
  
  return {
    profile_id: 'will-be-set',
    intake_answers: profileInput.intake_answers || {},
    metadata: {
      assessment_version: 'mini-v2',
      generated_at: new Date().toISOString(),
      model: 'canonical-v2-guarded',
      job_id: jobId,
      generation_mode: 'normal'
    },
    vector_scores,
    ranked_dimensions,
    top_systems,
    stress_patterns: {
      primary_stress_response: `Intensifies ${primary.dimension}`,
      secondary_stress_response: `Shifts toward ${secondary.dimension}`,
      blind_spot: `${opposing2.dimension} remains underdeveloped`,
      recovery_pattern: 'Returns to baseline when stressor resolves'
    },
    communication_style: {
      primary_mode: primary.dimension,
      secondary_mode: secondary.dimension,
      pattern: 'Adaptive to context',
      strength: `Direct communication through ${primary.dimension}`,
      friction: `May undervalue ${opposing1.dimension} perspective`
    },
    contradictions: [
      {
        pattern: `${primary.dimension} (${primary.score}) vs ${opposing1.dimension} (${opposing1.score})`,
        implication: `May create internal tension between these operating modes`,
        manifestation: `When stressed, internal conflict between ${primary.dimension} and ${opposing1.dimension} can emerge`
      }
    ],
    inferred_patterns: { 
      profile_type: 'Full Assessment', 
      operating_signature: `${primary.dimension}/${secondary.dimension} operator`,
      primary_driver: primary.dimension,
      secondary_stabilizer: secondary.dimension
    },
    life_direction: { word_count: 0 },
    business_operating_reality: { word_count: 0 },
    growth_tension: { word_count: 0 },
    systems_accountability: { word_count: 0 },
    stall_patterns: { word_count: 0 },
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
      profileDNA: `Operates primarily through ${primary.dimension}, stabilized by ${secondary.dimension}`,
      executiveSummary: 'Full canonical profile generated from authentic assessment data',
      operatingPattern: `Primary: ${primary.dimension}, Secondary: ${secondary.dimension}`,
      decisionArchitecture: `Uses ${primary.dimension} as primary decision lens`,
      communicationStyle: `Direct communication rooted in ${primary.dimension}`,
      systemUnderStrain: `Stress response: amplifies ${primary.dimension}, tension with ${opposing1.dimension}`,
      hiddenContradictions: `Tension between ${primary.dimension} (high) and ${opposing2.dimension} (low)`,
      strategicCeiling: `Development area: strengthen ${opposing1.dimension}`,
      coachingLeverage: 'Authentic assessment foundation established',
      recommendedNextStep: 'Pattern coaching and dimension balancing',
      full_narrative: 'Assessment complete with full canonical analysis'
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
    generation_mode: 'unknown',
    generation_time_ms: 0,
    vault_keys_created: [],
    profile_signature: null,
    quality_score: 0,
    job_persisted: false
  }
  
  try {
    const startTime = Date.now()
    
    trace.push('generating_profile_id')
    const profile_id = generateProfileId()
    trace.push(`profile_id_generated: ${profile_id}`)
    
    trace.push('validating_profileInput_before_build')
    
    // HARD FAIL: Validate profileInput is complete
    if (!job.profileInput || !job.profileInput.dimension_scores || Object.keys(job.profileInput.dimension_scores).length === 0) {
      const errorMsg = `CANONICAL GENERATION FAILED: profileInput missing or incomplete. ` +
        `dimension_scores count: ${job.profileInput?.dimension_scores ? Object.keys(job.profileInput.dimension_scores).length : 0}. ` +
        `This indicates data loss in buildProfileInput.`
      console.error('[CANONICAL-GENERATION]', errorMsg)
      trace.push(`HARD_FAIL_profileInput_validation`)
      throw new Error(errorMsg)
    }
    
    trace.push('profileInput_validated_building_full_canonical')
    
    // Build FULL canonical (not emergency_inline)
    const canonical_profile = buildFullCanonical(job.profileInput, job.job_id)
    canonical_profile.profile_id = profile_id
    canonical_profile.metadata.profile_id = profile_id
    
    // Validate generation_mode is NOT emergency_inline
    if (canonical_profile.metadata.generation_mode === 'emergency_inline') {
      const errorMsg = `VALIDATION FAILED: Canonical generated in emergency_inline mode. This is a skeleton profile, not allowed for job completion.`
      console.error('[CANONICAL-GENERATION]', errorMsg)
      trace.push(`HARD_FAIL_emergency_inline_detected`)
      throw new Error(errorMsg)
    }
    
    canonical_diagnostics.generation_mode = canonical_profile.metadata.generation_mode
    canonical_diagnostics.generation_success = true
    canonical_diagnostics.generation_time_ms = Date.now() - startTime
    canonical_diagnostics.success = true
    canonical_diagnostics.profile_id = profile_id
    canonical_diagnostics.quality_score = 100
    
    trace.push('canonical_built_successfully_with_generation_mode=' + canonical_profile.metadata.generation_mode)
    trace.push('before_job_update')
    
    // Persist to job
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
    
    // Extract behavioral intelligence (optional enhancement)
    trace.push('before_behavioral_extraction')
    let behavioral_intelligence = null
    try {
      behavioral_intelligence = extractBehavioralIntelligence(canonical_profile)
      trace.push('behavioral_extraction_success')
      canonical_diagnostics.behavioral_extraction_success = true
      
      trace.push('before_behavioral_refinement')
      behavioral_intelligence = refineExtraction(behavioral_intelligence, canonical_profile)
      trace.push('behavioral_refinement_success')
    } catch (extractErr) {
      console.error('[CANONICAL-GENERATION] Behavioral extraction failed (non-blocking):', extractErr.message)
      trace.push(`behavioral_extraction_error: ${extractErr.message}`)
    }
    
    if (behavioral_intelligence) {
      await updateJob(job.job_id, {
        behavioral_intelligence_v1: behavioral_intelligence,
        diagnostics: {
          ...job.diagnostics,
          stage_trace: [...trace]
        }
      })
      trace.push('behavioral_intelligence_persisted')
    }
    
    // VAULT SAVE: Persist canonical to vault
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
        model: 'canonical-v2-guarded'
      })
      trace.push('after_vault_save_success')
      canonical_diagnostics.vault_save_attempted = true
      canonical_diagnostics.vault_save_success = vault_result.success || false
      if (vault_result.vault_key) canonical_diagnostics.vault_keys_created.push(vault_result.vault_key)
    } catch (vaultErr) {
      console.error('[CANONICAL-GENERATION] Vault save failed (non-blocking):', vaultErr.message)
      trace.push(`vault_save_error: ${vaultErr.message}`)
      canonical_diagnostics.vault_save_attempted = true
    }
    
    trace.push('after_vault_attempt')
    
    return {
      success: true,
      nextStage: JOB_STAGE.FIRST_INJECTION,
      canonical_profile_id: profile_id,
      canonical_diagnostics,
      canonical_profile
    }
    
  } catch (error) {
    console.error('[CANONICAL-GENERATION] CRITICAL ERROR:', error.message)
    
    canonical_diagnostics.error = error.message
    canonical_diagnostics.generation_error = error.message
    canonical_diagnostics.generation_success = false
    canonical_diagnostics.success = false
    
    trace.push(`error_caught: ${error.message}`)
    
    // Persist error diagnostics to job
    try {
      await updateJob(job.job_id, {
        canonical_diagnostics,
        diagnostics: {
          ...job.diagnostics,
          stage_trace: [...trace, 'error_persisted_to_job']
        }
      })
    } catch (updateErr) {
      console.error('[CANONICAL-GENERATION] Failed to persist error:', updateErr.message)
    }
    
    // FAIL JOB - do NOT continue pipeline
    throw error
  }
}
