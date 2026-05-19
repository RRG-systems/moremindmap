/**
 * Redis Connectivity Test Endpoint
 * Verifies REDIS_URL configuration and ioredis client functionality
 */

import { redisGet, redisSet, redisDel, redisHealthCheck } from './engine/redisClient.js'

export default async function handler(req, res) {
  try {
    // Check environment
    const hasRedisUrl = !!process.env.REDIS_URL
    
    if (!hasRedisUrl) {
      return res.status(500).json({
        success: false,
        error: 'REDIS_URL environment variable not configured',
        client: 'ioredis',
        env_check: {
          REDIS_URL: 'missing'
        }
      })
    }

    // Health check
    const pingSuccess = await redisHealthCheck()
    if (!pingSuccess) {
      return res.status(500).json({
        success: false,
        error: 'Redis PING failed',
        client: 'ioredis',
        env_check: {
          REDIS_URL: 'present'
        }
      })
    }

    // Test key operations
    const testKey = 'test:connectivity:' + Date.now()
    const testValue = {
      status: 'testing',
      timestamp: new Date().toISOString(),
      random: Math.random()
    }

    // Write test
    await redisSet(testKey, testValue, { ex: 60 })
    console.log('[REDIS-TEST] Write successful:', testKey)

    // Read test
    const retrieved = await redisGet(testKey)
    const readMatched = retrieved && retrieved.status === testValue.status && retrieved.random === testValue.random
    console.log('[REDIS-TEST] Read successful:', retrieved)

    // Delete test
    const deleted = await redisDel(testKey)
    console.log('[REDIS-TEST] Delete successful:', deleted)

    // Verify deletion
    const afterDelete = await redisGet(testKey)
    const deleteVerified = afterDelete === null

    // Final result
    const allTestsPassed = readMatched && deleted && deleteVerified

    return res.status(allTestsPassed ? 200 : 500).json({
      success: allTestsPassed,
      message: allTestsPassed ? 'Redis connectivity verified' : 'Some tests failed',
      client: 'ioredis',
      test: {
        ping: pingSuccess ? 'OK' : 'FAILED',
        write: 'OK',
        read: readMatched ? 'OK' : 'FAILED',
        delete: deleted ? 'OK' : 'FAILED',
        delete_verified: deleteVerified ? 'OK' : 'FAILED'
      },
      env_check: {
        REDIS_URL: 'present (not exposed)'
      }
    })
  } catch (error) {
    console.error('[REDIS-TEST] Error:', error)
    return res.status(500).json({
      success: false,
      client: 'ioredis',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
