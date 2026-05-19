/**
 * Mini V2 Job Manager
 * Manages async report generation jobs using Redis storage via ioredis
 */

import { v4 as uuidv4 } from 'uuid'
import { redisGet, redisSet, redisDel } from './redisClient.js'

// Job TTL: 24 hours (86400 seconds)
const JOB_TTL = 86400

/**
 * Job statuses
 */
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  FAILED: 'failed'
}

/**
 * Job stages
 */
export const JOB_STAGE = {
  RECEIVED: 'received',
  FIRST_PASS_GENERATION: 'first_pass_generation',
  PLACEHOLDER_SCAN: 'placeholder_scan',
  REPAIR_PASS: 'repair_pass',
  REINJECTION: 'reinjection',
  VALIDATION: 'validation',
  COMPLETE: 'complete',
  FAILED: 'failed'
}

/**
 * Create new job
 */
export async function createJob(payload) {
  const jobId = uuidv4()
  const now = new Date().toISOString()
  
  const job = {
    job_id: jobId,
    status: JOB_STATUS.QUEUED,
    stage: JOB_STAGE.RECEIVED,
    progress_message: 'Job queued',
    created_at: now,
    updated_at: now,
    payload,
    result_html: null,
    result_metadata: {},
    error: null,
    diagnostics: {}
  }
  
  await redisSet(`job:${jobId}`, job, { ex: JOB_TTL })
  return jobId
}

/**
 * Get job by ID
 */
export async function getJob(jobId) {
  return await redisGet(`job:${jobId}`)
}

/**
 * Update job with partial patch
 */
export async function updateJob(jobId, patch) {
  const job = await getJob(jobId)
  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }
  
  const updated = {
    ...job,
    ...patch,
    updated_at: new Date().toISOString()
  }
  
  await redisSet(`job:${jobId}`, updated, { ex: JOB_TTL })
  return updated
}

/**
 * Complete job successfully
 */
export async function completeJob(jobId, result) {
  return await updateJob(jobId, {
    status: JOB_STATUS.COMPLETE,
    stage: JOB_STAGE.COMPLETE,
    progress_message: 'Report ready',
    result_html: result.html,
    result_metadata: result.metadata || {},
    diagnostics: result.diagnostics || {}
  })
}

/**
 * Fail job with error
 */
export async function failJob(jobId, error) {
  return await updateJob(jobId, {
    status: JOB_STATUS.FAILED,
    stage: JOB_STAGE.FAILED,
    progress_message: 'Generation failed',
    error: error.message || String(error)
  })
}

/**
 * Set job stage with progress message
 */
export async function setJobStage(jobId, stage, progressMessage = null) {
  const update = {
    status: JOB_STATUS.PROCESSING,
    stage
  }
  
  if (progressMessage) {
    update.progress_message = progressMessage
  } else {
    update.progress_message = stageToMessage(stage)
  }
  
  return await updateJob(jobId, update)
}

/**
 * Convert stage to user-friendly message
 */
function stageToMessage(stage) {
  const messages = {
    [JOB_STAGE.RECEIVED]: 'Job received',
    [JOB_STAGE.FIRST_PASS_GENERATION]: 'Analyzing response patterns',
    [JOB_STAGE.PLACEHOLDER_SCAN]: 'Building behavioral profile',
    [JOB_STAGE.REPAIR_PASS]: 'Refining missing sections',
    [JOB_STAGE.REINJECTION]: 'Checking profile completeness',
    [JOB_STAGE.VALIDATION]: 'Preparing final report',
    [JOB_STAGE.COMPLETE]: 'Report ready',
    [JOB_STAGE.FAILED]: 'Generation failed'
  }
  return messages[stage] || 'Processing...'
}

/**
 * Format job for API response
 */
export function formatJobResponse(job) {
  if (!job) {
    return {
      success: false,
      error: 'Job not found'
    }
  }
  
  if (job.status === JOB_STATUS.COMPLETE) {
    return {
      success: true,
      status: 'complete',
      job_id: job.job_id,
      html: job.result_html,
      metadata: job.result_metadata,
      diagnostics: job.diagnostics,
      created_at: job.created_at,
      updated_at: job.updated_at
    }
  }
  
  if (job.status === JOB_STATUS.FAILED) {
    return {
      success: false,
      status: 'failed',
      job_id: job.job_id,
      error: job.error,
      stage: job.stage,
      created_at: job.created_at,
      updated_at: job.updated_at
    }
  }
  
  // Queued or processing
  return {
    success: true,
    status: job.status,
    job_id: job.job_id,
    stage: job.stage,
    progress_message: job.progress_message,
    created_at: job.created_at,
    updated_at: job.updated_at
  }
}
