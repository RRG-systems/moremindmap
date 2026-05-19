/**
 * Mini V2 Async Generator
 * Wraps existing synchronous generation pipeline for async job execution
 * Preserves all existing logic, adds stage tracking and Redis updates
 */

import { buildProfileInput } from './buildProfileInput.js'
import { generateReportContent } from './generateReportContent.js'
import { injectReportContent } from './injectReportContent.js'
import { normalizeRepairResponse } from './miniV2FieldMap.js'
import { mergeRepairedFields, groupMissingFieldsByPage } from './miniV2FieldMap.js'
import { setJobStage, completeJob, failJob, JOB_STAGE } from './miniV2JobManager.js'

/**
 * Execute full Mini V2 generation pipeline
 * Updates job state at each stage
 */
export async function executeGeneration(jobId, payload) {
  try {
    const { answers } = payload
    
    // Stage 1: First-pass generation
    await setJobStage(jobId, JOB_STAGE.FIRST_PASS_GENERATION, 'Analyzing response patterns')
    
    const profileInput = buildProfileInput(answers)
    let reportContent = await generateReportContent(profileInput)
    
    // Stage 2: First injection and placeholder scan
    await setJobStage(jobId, JOB_STAGE.PLACEHOLDER_SCAN, 'Building behavioral profile')
    
    let result = await injectReportContent(reportContent)
    let html = result.html
    let snapshot = result.snapshot
    
    const firstPassPlaceholderCount = snapshot.placeholder_count
    let repairAttempted = false
    let repairFieldsRequested = 0
    let repairFieldsWritten = 0
    
    // Stage 3: Repair pass if needed
    if (snapshot.placeholder_count > 0) {
      await setJobStage(jobId, JOB_STAGE.REPAIR_PASS, 'Refining missing sections')
      
      repairAttempted = true
      repairFieldsRequested = snapshot.placeholders.length
      
      const missingFields = snapshot.placeholders
      const groupedFields = groupMissingFieldsByPage(missingFields)
      
      // Generate repair content
      const repairResponse = await generateReportContent(profileInput, groupedFields)
      const normalizedRepairs = normalizeRepairResponse(repairResponse, missingFields)
      
      // Merge repairs
      const mergeStats = mergeRepairedFields(reportContent, normalizedRepairs)
      repairFieldsWritten = mergeStats.written
      
      // Stage 4: Reinjection
      await setJobStage(jobId, JOB_STAGE.REINJECTION, 'Checking profile completeness')
      
      const repairResult = await injectReportContent(reportContent)
      html = repairResult.html
      snapshot = repairResult.snapshot
    }
    
    // Stage 5: Validation
    await setJobStage(jobId, JOB_STAGE.VALIDATION, 'Preparing final report')
    
    const finalPlaceholderCount = snapshot.placeholder_count
    
    // Complete job
    await completeJob(jobId, {
      html,
      metadata: {
        placeholder_count: finalPlaceholderCount,
        pages_rendered: snapshot.pages_rendered,
        coverage_percent: snapshot.coverage_percent,
        generation_mode: 'gpt'
      },
      diagnostics: {
        first_pass_placeholder_count: firstPassPlaceholderCount,
        final_placeholder_count: finalPlaceholderCount,
        repair_attempted: repairAttempted,
        repair_fields_requested: repairFieldsRequested,
        repair_fields_written: repairFieldsWritten
      }
    })
    
    return { success: true }
  } catch (error) {
    console.error(`[MINI-V2-ASYNC] Generation error for job ${jobId}:`, error)
    await failJob(jobId, error)
    return { success: false, error: error.message }
  }
}
