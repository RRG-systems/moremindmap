/**
 * Mini V2 Async Job Start Endpoint
 * POST /api/moremindmap/mini-profile-v2-start
 * 
 * Accepts assessment answers, creates job, returns job_id immediately
 */

import { createJob } from '../engine/miniV2JobManager.js'
import { executeGeneration } from '../engine/miniV2AsyncGenerator.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { answers, metadata = {} } = req.body

    // Validate answers
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: answers required'
      })
    }

    // Quick validation: answers should have entries
    const answerCount = Object.keys(answers).length
    if (answerCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: no answers provided'
      })
    }

    // Create job in Redis
    const jobId = await createJob({ answers, metadata })

    // Start async generation (fire and forget)
    // Vercel serverless may not reliably continue after response
    // So we start it but status endpoint will also advance if needed
    executeGeneration(jobId, { answers }).catch(err => {
      console.error(`[MINI-V2-START] Background generation error:`, err)
    })

    // Return immediately
    return res.status(200).json({
      success: true,
      job_id: jobId,
      status: 'queued',
      message: 'Report generation started. Poll /api/moremindmap/mini-profile-v2-status?job_id=' + jobId
    })
  } catch (error) {
    console.error('[MINI-V2-START] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
