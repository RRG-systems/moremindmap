// Test importing job manager only
import { createJob } from '../engine/miniV2JobManager.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  return res.status(200).json({
    success: true,
    route: 'start-test2-with-import',
    has_createJob: typeof createJob === 'function'
  })
}
