// Test async generator import
import { executeGeneration } from '../engine/miniV2AsyncGenerator.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  return res.status(200).json({
    success: true,
    route: 'start-test6-async-gen',
    has_executeGeneration: typeof executeGeneration === 'function'
  })
}
