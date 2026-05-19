/**
 * Test Redis connectivity with REDIS_URL
 */

import { Redis } from '@upstash/redis'

export default async function handler(req, res) {
  try {
    // Check what env vars are available
    const envCheck = {
      REDIS_URL: process.env.REDIS_URL ? 'present' : 'missing',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'present' : 'missing',
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'present' : 'missing',
      KV_REST_API_URL: process.env.KV_REST_API_URL ? 'present' : 'missing',
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? 'present' : 'missing'
    }
    
    // Initialize Redis client
    // If REDIS_URL is standard format (redis://...), parse it
    let redis
    if (process.env.REDIS_URL && process.env.REDIS_URL.startsWith('redis')) {
      // Standard Redis URL - need to convert or use different client
      return res.status(500).json({
        success: false,
        error: 'REDIS_URL is standard format, not REST API format',
        env_check: envCheck,
        redis_url_prefix: process.env.REDIS_URL?.substring(0, 20)
      })
    } else if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    } else {
      return res.status(500).json({
        success: false,
        error: 'No compatible Redis env vars found',
        env_check: envCheck
      })
    }
    
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
      env_check: envCheck
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
