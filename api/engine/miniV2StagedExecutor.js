/**
 * Mini V2 Staged Executor
 * Poll-driven execution - each function executes ONE bounded stage
 * Prevents serverless timeout by breaking pipeline into small chunks
 */

import { updateJob, lockJob, unlockJob, JOB_STAGE, JOB_STATUS } from './miniV2JobManager.js'

/**
 * Stage 1: First-pass generation
 * Builds profile input and calls OpenAI for initial report content
 */
export async function executeFirstPassGeneration(job) {
  const { buildProfileInput } = await import('./buildProfileInput.js')
  const { generateReportContent } = await import('./generateReportContent.js')
  
  const { answers } = job.payload
  
  // Build profile input (must wrap answers in object)
  const profileInput = await buildProfileInput({ answers })
  
  // Generate report content (OpenAI call)
  const reportContent = await generateReportContent(profileInput)
  
  // Store intermediate state and advance stage
  await updateJob(job.job_id, {
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGE.FIRST_INJECTION,
    progress_message: 'Building behavioral profile',
    profileInput,
    reportContent
  })
  
  return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
}

/**
 * Stage 2: First injection
 * Injects report content into templates and scans for placeholders
 */
export async function executeFirstInjection(job) {
  const { injectReportContent } = await import('./injectReportContent.js')
  
  const { reportContent } = job
  
  // Inject content and get snapshot
  const result = await injectReportContent(reportContent)
  const { html, snapshot } = result
  
  const placeholderCount = snapshot.placeholder_count
  
  // Store snapshot
  await updateJob(job.job_id, {
    firstSnapshot: snapshot,
    diagnostics: {
      ...job.diagnostics,
      first_pass_placeholder_count: placeholderCount
    }
  })
  
  // Check if repair needed
  if (placeholderCount > 0) {
    const missingFields = snapshot.placeholders
    
    await updateJob(job.job_id, {
      stage: JOB_STAGE.REPAIR_PASS,
      progress_message: 'Refining missing sections',
      missingFields
    })
    
    return { success: true, nextStage: JOB_STAGE.REPAIR_PASS, placeholderCount }
  } else {
    // No repair needed, complete immediately
    await updateJob(job.job_id, {
      status: JOB_STATUS.COMPLETE,
      stage: JOB_STAGE.COMPLETE,
      progress_message: 'Report ready',
      result_html: html,
      result_metadata: {
        placeholder_count: 0,
        pages_rendered: snapshot.pages_rendered,
        coverage_percent: snapshot.coverage_percent,
        generation_mode: 'gpt'
      },
      diagnostics: {
        ...job.diagnostics,
        final_placeholder_count: 0,
        repair_attempted: false
      }
    })
    
    return { success: true, nextStage: JOB_STAGE.COMPLETE, placeholderCount: 0 }
  }
}

/**
 * Stage 3: Repair pass
 * Generates missing content for placeholders
 */
export async function executeRepairPass(job) {
  const { generateReportContent } = await import('./generateReportContent.js')
  const { normalizeRepairResponse, mergeRepairedFields, groupMissingFieldsByPage } = await import('./miniV2FieldMap.js')
  
  const { profileInput, reportContent, missingFields } = job
  
  // Group fields by page
  const groupedFields = groupMissingFieldsByPage(missingFields)
  
  // Generate repair content
  const repairResponse = await generateReportContent(profileInput, groupedFields)
  const normalizedRepairs = normalizeRepairResponse(repairResponse, missingFields)
  
  // Merge repairs into report content
  const mergeStats = mergeRepairedFields(reportContent, normalizedRepairs)
  
  // Store updated content and advance
  await updateJob(job.job_id, {
    stage: JOB_STAGE.FINAL_INJECTION,
    progress_message: 'Preparing final report',
    reportContent, // Updated in place by merge
    diagnostics: {
      ...job.diagnostics,
      repair_attempted: true,
      repair_fields_requested: missingFields.length,
      repair_fields_written: mergeStats.written
    }
  })
  
  return { 
    success: true, 
    nextStage: JOB_STAGE.FINAL_INJECTION,
    fieldsWritten: mergeStats.written 
  }
}

/**
 * Stage 4: Final injection
 * Re-injects repaired content and validates completion
 */
export async function executeFinalInjection(job) {
  const { injectReportContent } = await import('./injectReportContent.js')
  
  const { reportContent } = job
  
  // Re-inject with repaired content
  const result = await injectReportContent(reportContent)
  const { html, snapshot } = result
  
  const finalPlaceholderCount = snapshot.placeholder_count
  
  if (finalPlaceholderCount === 0) {
    // Success
    await updateJob(job.job_id, {
      status: JOB_STATUS.COMPLETE,
      stage: JOB_STAGE.COMPLETE,
      progress_message: 'Report ready',
      result_html: html,
      result_metadata: {
        placeholder_count: 0,
        pages_rendered: snapshot.pages_rendered,
        coverage_percent: snapshot.coverage_percent,
        generation_mode: 'gpt'
      },
      diagnostics: {
        ...job.diagnostics,
        final_placeholder_count: 0
      }
    })
    
    return { success: true, nextStage: JOB_STAGE.COMPLETE, placeholderCount: 0 }
  } else {
    // Still has placeholders - mark as failed
    await updateJob(job.job_id, {
      status: JOB_STATUS.FAILED,
      stage: JOB_STAGE.FAILED,
      progress_message: 'Generation incomplete',
      error: `${finalPlaceholderCount} placeholders remain after repair`,
      diagnostics: {
        ...job.diagnostics,
        final_placeholder_count: finalPlaceholderCount,
        remaining_placeholders: snapshot.placeholders.slice(0, 10)
      }
    })
    
    return { success: false, nextStage: JOB_STAGE.FAILED, placeholderCount: finalPlaceholderCount }
  }
}

/**
 * Execute next stage for a job
 * Returns result or throws error
 */
export async function executeNextStage(job) {
  const stage = job.stage
  
  try {
    switch (stage) {
      case JOB_STAGE.RECEIVED:
        return await executeFirstPassGeneration(job)
      
      case JOB_STAGE.FIRST_PASS_GENERATION:
        return await executeFirstInjection(job)
      
      case JOB_STAGE.FIRST_INJECTION:
        return await executeRepairPass(job)
      
      case JOB_STAGE.REPAIR_PASS:
        return await executeFinalInjection(job)
      
      default:
        throw new Error(`Unknown stage: ${stage}`)
    }
  } catch (error) {
    console.error(`[STAGED-EXECUTOR] Error in stage ${stage}:`, error)
    
    // Log error to job
    await updateJob(job.job_id, {
      status: JOB_STATUS.FAILED,
      stage: JOB_STAGE.FAILED,
      error: error.message || String(error)
    })
    
    throw error
  }
}
