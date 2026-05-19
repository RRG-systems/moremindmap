/**
 * Test Redis connectivity with REDIS_URL
 */

import { Redis } from '@upstash/redis'

export default async function handler(req, res) {
  try {
    // Initialize Redis client with REDIS_URL
    const redis = Redis.fromEnv()
    
    const testKey = 'test:connectivity:' + Date.now()
    const testValue = { status: 'connected', timestamp: new Date().toISOString() }
    
    // Write test key
    await redis.set(testKey, JSON.stringify(testValue), { ex: 60 })
    console.log('[REDIS-TEST] Write successful:', testKey)
    
    // Read test key
    const retrieved = await redis.get(testKey)
    console.log('[REDIS-TEST] Read successful:', retrieved)
    
    // Delete test key
    await redis.del(testKey)
    console.log('[REDIS-TEST] Delete successful:', testKey)
    
    // Verify deletion
    const deleted = await redis.get(testKey)
    
    return res.status(200).json({
      success: true,
      message: 'Redis connectivity verified',
      test: {
        write: 'OK',
        read: retrieved ? 'OK' : 'FAILED',
        delete: deleted === null ? 'OK' : 'FAILED'
      },
      env_var: process.env.REDIS_URL ? 'REDIS_URL present' : 'REDIS_URL missing'
    })
  } catch (error) {
    console.error('[REDIS-TEST] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}
