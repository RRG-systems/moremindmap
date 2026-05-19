/**
 * Mini V2 Async Job Status Endpoint
 * GET /api/moremindmap/mini-profile-v2-status?job_id=...
 * 
 * Returns job status. If queued and not started, advances generation.
 * This handles cases where background execution didn't continue after start response.
 */

import { getJob, formatJobResponse, JOB_STATUS } from '../engine/miniV2JobManager.js'
import { executeGeneration } from '../engine/miniV2AsyncGenerator.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { job_id } = req.query

    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: 'job_id required'
      })
    }

    // Get job from Redis
    let job = await getJob(job_id)

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      })
    }

    // If job is queued and hasn't started processing, start it now
    // This handles serverless environments where background execution may not persist
    if (job.status === JOB_STATUS.QUEUED) {
      // Start generation (fire and forget, don't block response)
      executeGeneration(job_id, job.payload).catch(err => {
        console.error(`[MINI-V2-STATUS] Generation error:`, err)
      })
      
      // Return current queued status
      // Next poll will show processing
      return res.status(200).json(formatJobResponse(job))
    }

    // Return formatted response
    const response = formatJobResponse(job)
    return res.status(response.success ? 200 : 500).json(response)
  } catch (error) {
    console.error('[MINI-V2-STATUS] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
