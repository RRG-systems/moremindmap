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

    // Format answers for backend compatibility
    // Backend expects: { qN: { choice: 'A' } } or { qN: { text: 'written response' } }
    // Frontend may send: { N: 'A' } or { N: 'written response' }
    const formattedAnswers = {}
    Object.keys(answers).forEach(key => {
      const qKey = key.startsWith('q') ? key : `q${key}`
      const value = answers[key]
      
      // Detect if it's a written response (long text) or multiple choice (single letter)
      if (typeof value === 'string' && value.length === 1 && /[A-E]/i.test(value)) {
        // Multiple choice
        formattedAnswers[qKey] = { choice: value.toUpperCase() }
      } else if (typeof value === 'object' && (value.choice || value.text)) {
        // Already formatted
        formattedAnswers[qKey] = value
      } else {
        // Written response
        formattedAnswers[qKey] = { text: String(value) }
      }
    })

    // Create job in Redis (queued, no execution yet)
    const jobId = await createJob({ answers: formattedAnswers, metadata })

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
