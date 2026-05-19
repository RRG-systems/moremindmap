// Job inspection endpoint
import { redisGet } from '../engine/redisClient.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  const { job_id } = req.query
  
  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' })
  }
  
  try {
    const job = await redisGet(`job:${job_id}`)
    
    if (!job) {
      return res.status(404).json({ 
        success: false,
        error: 'Job not found in Redis',
        job_id 
      })
    }
    
    // Calculate elapsed time
    const created = new Date(job.created_at)
    const updated = new Date(job.updated_at)
    const now = new Date()
    
    const elapsedTotal = Math.round((now - created) / 1000)
    const elapsedSinceUpdate = Math.round((now - updated) / 1000)
    
    // Check for result
    const hasHTML = !!job.result_html
    const htmlLength = job.result_html ? job.result_html.length : 0
    
    return res.status(200).json({
      success: true,
      job_id: job.job_id,
      status: job.status,
      stage: job.stage,
      progress_message: job.progress_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
      elapsed_total_seconds: elapsedTotal,
      elapsed_since_update_seconds: elapsedSinceUpdate,
      has_result_html: hasHTML,
      result_html_length: htmlLength,
      error: job.error,
      diagnostics: job.diagnostics || {},
      metadata: job.result_metadata || {}
    })
  } catch (error) {
    console.error('[INSPECT-JOB] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
