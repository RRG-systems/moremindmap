/**
 * Redis Client Wrapper for Mini V2 Jobs
 * Uses ioredis with REDIS_URL from Vercel environment
 * Lazy initialization, safe error handling, JSON serialization
 */

import Redis from 'ioredis'

let client = null

/**
 * Get or create Redis client (lazy initialization)
 */
function getClient() {
  if (client) return client

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not configured')
  }

  // Initialize with connection string
  // ioredis handles redis:// URLs automatically
  client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false // Connect immediately but don't block module load
  })

  client.on('error', (err) => {
    console.error('[REDIS] Connection error:', err.message)
  })

  client.on('connect', () => {
    console.log('[REDIS] Connected successfully')
  })

  return client
}

/**
 * Get value from Redis
 * Returns parsed JSON object or null if not found
 */
export async function redisGet(key) {
  try {
    const client = getClient()
    const data = await client.get(key)
    if (!data) return null
    return JSON.parse(data)
  } catch (error) {
    console.error(`[REDIS] Get error for key ${key}:`, error.message)
    throw new Error(`Redis get failed: ${error.message}`)
  }
}

/**
 * Set value in Redis
 * Value is JSON-serialized automatically
 * Options: { ex: seconds } for expiration
 */
export async function redisSet(key, value, options = {}) {
  try {
    const client = getClient()
    const serialized = JSON.stringify(value)
    
    if (options.ex) {
      await client.setex(key, options.ex, serialized)
    } else {
      await client.set(key, serialized)
    }
    
    return true
  } catch (error) {
    console.error(`[REDIS] Set error for key ${key}:`, error.message)
    throw new Error(`Redis set failed: ${error.message}`)
  }
}

/**
 * Delete key from Redis
 */
export async function redisDel(key) {
  try {
    const client = getClient()
    const result = await client.del(key)
    return result > 0
  } catch (error) {
    console.error(`[REDIS] Delete error for key ${key}:`, error.message)
    throw new Error(`Redis delete failed: ${error.message}`)
  }
}

/**
 * Set expiration on key (seconds)
 */
export async function redisExpire(key, seconds) {
  try {
    const client = getClient()
    const result = await client.expire(key, seconds)
    return result === 1
  } catch (error) {
    console.error(`[REDIS] Expire error for key ${key}:`, error.message)
    throw new Error(`Redis expire failed: ${error.message}`)
  }
}

/**
 * Health check - verify Redis is reachable
 */
export async function redisHealthCheck() {
  try {
    const client = getClient()
    const pong = await client.ping()
    return pong === 'PONG'
  } catch (error) {
    console.error('[REDIS] Health check failed:', error.message)
    return false
  }
}

/**
 * Export raw Redis client for direct access when needed
 * Use with caution - prefer typed functions above
 */
export function redis() {
  return getClient()
}
