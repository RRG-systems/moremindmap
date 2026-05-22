/**
 * Production Job Inspection Diagnostic Endpoint
 * GET /api/diagnostic/list-recent-jobs?limit=10
 * 
 * Purpose: Inspect recent assessment jobs to determine if they reached canonical/Vault stages
 * Security: Masks sensitive data, no full answers, no secrets, no OpenAI keys
 * 
 * Returns job execution visibility for debugging failed assessments
 */

import { redisGet, redis as getRedis } from '../engine/redisClient.js'

function maskEmail(email) {
  if (!email || email.length < 3) return email
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const name = parts[0]
  const domain = parts[1]
  return `${name.substring(0, 2)}***@${domain}`
}

function summarizeError(error) {
  if (!error) return null
  if (typeof error === 'string') {
    return error.substring(0, 100)
  }
  if (error.message) {
    return error.message.substring(0, 100)
  }
  return String(error).substring(0, 100)
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const limit = Math.min(parseInt(req.query.limit || '10'), 50)
    
    const rc = getRedis()
    
    // Try to fetch from jobs:recent index
    let jobIds = []
    try {
      jobIds = await rc.lrange('jobs:recent', 0, Math.max(0, limit - 1))
    } catch (e) {
      // Index may not exist yet - fail silently
    }
    
    if (!jobIds || jobIds.length === 0) {
      return res.status(200).json({
        ok: true,
        environment: process.env.VERCEL_ENV || 'unknown',
        redis_visible: true,
        recent_jobs_index_found: false,
        total_jobs_found: 0,
        message: 'No jobs in recent index (jobs:recent does not exist or is empty)',
        jobs: []
      })
    }

    // Fetch job data for each job ID
    const jobs = []
    for (const jobId of jobIds) {
      try {
        const job = await redisGet(`job:${jobId}`)
        
        if (job) {
          const metadata = job.payload?.metadata || {}
          const canonicalDiag = job.canonical_diagnostics || {}
          
          jobs.push({
            job_id: jobId,
            created_at: job.created_at,
            updated_at: job.updated_at,
            status: job.status,
            stage: job.stage,
            current_stage: job.stage,
            completed: job.status === 'complete',
            error_present: !!job.error,
            error_summary: summarizeError(job.error),
            
            // Metadata presence (without exposing data)
            metadata_present: !!metadata && Object.keys(metadata).length > 0,
            person_name_present: !!metadata.person_name,
            email_present: !!metadata.email,
            email_masked: metadata.email ? maskEmail(metadata.email) : null,
            
            // Answer diagnostics
            answer_count: job.payload?.answers ? Object.keys(job.payload.answers).length : 0,
            written_answer_count: job.payload?.answers 
              ? Object.values(job.payload.answers).filter(a => a?.written_response).length 
              : 0,
            
            // Canonical generation diagnostics
            canonical_generation_attempted: canonicalDiag.attempted || false,
            canonical_generation_success: canonicalDiag.success || false,
            canonical_generation_error_summary: summarizeError(canonicalDiag.error),
            canonical_profile_id: canonicalDiag.profile_id || null,
            
            // Vault save diagnostics
            vault_save_attempted: canonicalDiag.vault_save_attempted || false,
            vault_save_success: canonicalDiag.vault_save_success || false,
            vault_save_error_summary: summarizeError(canonicalDiag.vault_save_error),
            
            // Output presence
            has_report_content: !!job.reportContent,
            has_result_html: !!job.result_html,
            has_pdf_or_output: !!job.result_html // HTML can be rendered to PDF downstream
          })
        }
      } catch (e) {
        // Skip jobs that can't be fetched
      }
    }

    return res.status(200).json({
      ok: true,
      environment: process.env.VERCEL_ENV || 'unknown',
      redis_visible: true,
      recent_jobs_index_found: true,
      total_jobs_found: jobs.length,
      timestamp: new Date().toISOString(),
      jobs
    })

  } catch (error) {
    console.error('[DIAGNOSTIC] list-recent-jobs error:', error)
    
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to list recent jobs',
      timestamp: new Date().toISOString()
    })
  }
}
