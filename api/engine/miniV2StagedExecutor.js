/**
 * Mini V2 Staged Executor
 * Poll-driven execution - each function executes ONE bounded stage
 * Prevents serverless timeout by breaking pipeline into small chunks
 */

import { getJob, updateJob, lockJob, unlockJob, JOB_STAGE, JOB_STATUS } from './miniV2JobManager.js'

/**
 * Extract placeholder field names from HTML
 */
function extractPlaceholdersFromHtml(html) {
  if (!html || typeof html !== 'string') {
    return []
  }
  
  const placeholderRegex = /\{\{([^}]+)\}\}/g
  const matches = []
  let match
  
  while ((match = placeholderRegex.exec(html)) !== null) {
    // Extract field name and clean whitespace
    const fieldName = match[1].trim()
    if (fieldName && !matches.includes(fieldName)) {
      matches.push(fieldName)
    }
  }
  
  return matches
}

/**
 * Stage 1: First-pass generation
 * Builds profile input and calls OpenAI for initial report content
 */
export async function executeFirstPassGeneration(job) {
  const trace = job.diagnostics?.stage_trace || []
  trace.push('ENTER_first_pass_generation')
  
  const { buildProfileInput } = await import('./buildProfileInput.js')
  const { generateReportContent } = await import('./generateReportContent.js')
  
  const { answers } = job.payload
  
  trace.push('before_buildProfileInput')
  const profileInput = await buildProfileInput({ answers })
  trace.push('after_buildProfileInput')
  
  trace.push('before_generateReportContent')
  const reportContent = await generateReportContent(profileInput)
  trace.push('after_generateReportContent')
  
  // Validate reportContent structure
  const contentKeys = reportContent ? Object.keys(reportContent) : []
  const pageKeys = contentKeys.filter(k => k.startsWith('page'))
  const nullPages = pageKeys.filter(k => reportContent[k] === null)
  
  if (nullPages.length > 0) {
    console.warn('[STAGED-EXECUTOR] Null pages detected:', nullPages)
  }
  
  trace.push('BEFORE_UPDATE_to_first_injection')
  
  await updateJob(job.job_id, {
    status: JOB_STATUS.PROCESSING,
    stage: JOB_STAGE.FIRST_INJECTION,
    progress_message: 'Building behavioral profile',
    profileInput,
    reportContent,
    diagnostics: {
      ...job.diagnostics,
      content_keys: contentKeys.length,
      page_keys: pageKeys.length,
      null_pages: nullPages.length > 0 ? nullPages : undefined,
      stage_trace: [...trace, 'AFTER_UPDATE_to_first_injection'],
      last_stage_completed: 'first_pass_generation',
      transition_to: 'first_injection'
    }
  })
  
  trace.push('EXIT_first_pass_generation')
  return { success: true, nextStage: JOB_STAGE.FIRST_INJECTION }
}

/**
 * Stage 2: First injection
 * Injects report content into templates and scans for placeholders
 */
export async function executeFirstInjection(job) {
  const trace = job.diagnostics?.stage_trace || []
  trace.push('ENTER_first_injection')
  
  const { injectReportContent } = await import('./injectReportContent.js')
  
  const { reportContent } = job
  trace.push('got_reportContent_from_job')
  
  if (!reportContent) {
    throw new Error('reportContent is null or undefined')
  }
  
  trace.push('before_injectReportContent')
  
  let result
  try {
    result = await injectReportContent(reportContent)
    trace.push('after_injectReportContent_success')
  } catch (error) {
    trace.push('CATCH_injectReportContent: ' + error.message)
    throw new Error(`injectReportContent failed: ${error.message}`)
  }
  
  if (!result) {
    throw new Error('injectReportContent returned null')
  }
  
  const { html, snapshot } = result
  
  if (!snapshot) {
    throw new Error('snapshot is null')
  }
  
  const placeholderCount = snapshot.placeholder_count
  trace.push('got_placeholder_count: ' + placeholderCount)
  
  // Store snapshot
  trace.push('BEFORE_UPDATE_firstSnapshot')
  await updateJob(job.job_id, {
    firstSnapshot: snapshot,
    diagnostics: {
      ...job.diagnostics,
      first_pass_placeholder_count: placeholderCount,
      stage_trace: [...trace, 'AFTER_UPDATE_firstSnapshot']
    }
  })
  trace.push('stored_firstSnapshot')
  
  // Check if repair needed
  if (placeholderCount > 0) {
    // Get missingFields from snapshot or extract from HTML
    let missingFields = snapshot.placeholders
    
    if (!missingFields || !Array.isArray(missingFields) || missingFields.length === 0) {
      console.warn('[FIRST-INJECTION] snapshot.placeholders invalid, extracting from HTML')
      missingFields = extractPlaceholdersFromHtml(html)
      
      if (missingFields.length === 0) {
        console.error('[FIRST-INJECTION] placeholder_count > 0 but no placeholders found in HTML')
        // Complete anyway since we can't repair without field names
        await updateJob(job.job_id, {
          status: JOB_STATUS.COMPLETE,
          stage: JOB_STAGE.COMPLETE,
          progress_message: 'Report complete (placeholder count mismatch)',
          result_html: html,
          result_metadata: {
            placeholder_count: placeholderCount,
            pages_rendered: snapshot.pages_rendered,
            coverage_percent: snapshot.coverage_percent,
            generation_mode: 'gpt'
          },
          diagnostics: {
            ...job.diagnostics,
            final_placeholder_count: placeholderCount,
            repair_attempted: false,
            repair_skip_reason: 'Could not extract placeholder field names'
          }
        })
        return { success: true, nextStage: JOB_STAGE.COMPLETE, placeholderCount }
      }
    }
    
    trace.push('missingFields_length: ' + missingFields.length)
    trace.push('BEFORE_UPDATE_to_repair_pass')
    
    await updateJob(job.job_id, {
      stage: JOB_STAGE.REPAIR_PASS,
      progress_message: 'Refining missing sections',
      missingFields: missingFields,
      diagnostics: {
        ...job.diagnostics,
        missing_fields_count: missingFields.length,
        stage_trace: [...trace, 'AFTER_UPDATE_to_repair_pass'],
        last_stage_completed: 'first_injection',
        transition_to: 'repair_pass'
      }
    })
    trace.push('EXIT_first_injection_to_repair')
    
    return { success: true, nextStage: JOB_STAGE.REPAIR_PASS, placeholderCount }
  } else {
    trace.push('no_placeholders_completing')
    trace.push('BEFORE_UPDATE_to_complete')
    
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
        repair_attempted: false,
        stage_trace: [...trace, 'AFTER_UPDATE_to_complete'],
        last_stage_completed: 'first_injection'
      }
    })
    trace.push('EXIT_first_injection_complete')
    
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
  
  // Validate missingFields
  if (!missingFields || !Array.isArray(missingFields)) {
    throw new Error(`executeRepairPass: missingFields is ${missingFields === null ? 'null' : typeof missingFields}, expected array. Job keys: ${Object.keys(job).join(', ')}`)
  }
  
  if (missingFields.length === 0) {
    throw new Error('executeRepairPass: missingFields is empty array')
  }
  
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
    console.error(`[STAGED-EXECUTOR] Stack:`, error.stack)
    
    // Get current trace from job
    const currentJob = await getJob(job.job_id)
    const errorTrace = currentJob?.diagnostics?.stage_trace || []
    errorTrace.push(`CATCH_executeNextStage_in_${stage}: ${error.message}`)
    
    // Log error to job with stack trace AND preserve stage trace
    await updateJob(job.job_id, {
      status: JOB_STATUS.FAILED,
      stage: JOB_STAGE.FAILED,
      error: error.message || String(error),
      diagnostics: {
        ...currentJob?.diagnostics,
        error_stage: stage,
        error_before_stage_update: true,
        stage_trace: [...errorTrace, 'ERROR_HANDLER_updated_to_failed'],
        error_stack: error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : null
      }
    })
    
    throw error
  }
}
