// Test redis + uuid together
import { v4 as uuidv4 } from 'uuid'
import { redisSet, redisGet } from '../engine/redisClient.js'

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  
  const testId = uuidv4()
  
  return res.status(200).json({
    success: true,
    route: 'start-test5-both',
    test_uuid: testId,
    has_redisSet: typeof redisSet === 'function'
  })
}
