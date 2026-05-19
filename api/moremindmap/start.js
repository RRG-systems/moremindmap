/**
 * Mini V2 Async Job Start Endpoint
 * POST /api/moremindmap/mini-profile-v2-start
 * 
 * Accepts assessment answers, creates job, returns job_id immediately
 */

import { createJob } from '../engine/miniV2JobManager.js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", true)
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")
  res.setHeader('Content-Type', 'application/json')

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

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

    // Create job in Redis (queued, no execution yet)
    const jobId = await createJob({ answers, metadata })

    // Return immediately - status endpoint will drive execution
    return res.status(200).json({
      success: true,
      job_id: jobId,
      status: 'queued',
      message: 'Report generation queued. Poll /api/moremindmap/status?job_id=' + jobId
    })
  } catch (error) {
    console.error('[MINI-V2-START] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    })
  }
}
