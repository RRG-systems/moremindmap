// Test redis client import only
import { redisGet } from '../engine/redisClient.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  return res.status(200).json({
    success: true,
    route: 'start-test3-redis-import',
    has_redisGet: typeof redisGet === 'function'
  })
}
