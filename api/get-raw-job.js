// Get raw job data from Redis
import { redisGet } from './engine/redisClient.js'

export default async function handler(req, res) {
  const { job_id } = req.query
  
  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' })
  }
  
  try {
    const job = await redisGet(`job:${job_id}`)
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    
    // Return complete raw job (be careful with size)
    const size = JSON.stringify(job).length
    
    if (size > 100000) {
      // Too large, return subset
      return res.status(200).json({
        size_bytes: size,
        keys: Object.keys(job),
        diagnostics: job.diagnostics,
        error: job.error,
        status: job.status,
        stage: job.stage,
        result_html_length: job.result_html ? job.result_html.length : 0
      })
    }
    
    return res.status(200).json(job)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
