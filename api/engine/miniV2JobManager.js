/* global process */

/**
 * Mini V2 Job Manager
 * Manages async report generation jobs using Redis storage via ioredis
 */

import { v4 as uuidv4 } from 'uuid'
import { redisGet, redisSet, redis as getRedis } from './redisClient.js'
import { createHash } from 'node:crypto'
import { BOS_INTAKE_DRAFT_TTL_SECONDS } from './bosIntakeDraftV1.js'

// Job TTL: 24 hours (86400 seconds)
export const BOS_JOB_TTL_SECONDS = 86400
export const RECRUITING_BOS_JOB_TTL_SECONDS = BOS_INTAKE_DRAFT_TTL_SECONDS
const JOB_EXECUTION_LEASE_TTL_MS = 30 * 60 * 1000
export const JOB_EXECUTION_PROTOCOL_VERSION = 2
export const LEGACY_JOB_EXECUTION_DRAIN_MS = 800 * 1000
export const MINI_V2_EXECUTION_ACTIVATION_ENV = 'MINI_V2_EXECUTION_ACTIVATION_ID'
export const MINI_V2_EXECUTION_DISABLED_ENV = 'MINI_V2_EXECUTION_DISABLED'
export const LEGACY_JOB_EXECUTION_DRAIN_KEY = 'mini-v2:execution-protocol:v2:legacy-drain-started-at-ms'

export function resolveMiniV2ExecutionActivationId(env = process.env) {
  const configured = String(env?.[MINI_V2_EXECUTION_ACTIVATION_ENV] || '').trim()
  if (configured) return configured
  if (String(env?.VERCEL_ENV || '').trim().toLowerCase() === 'production') {
    throw new Error('BOS_JOB_EXECUTION_ACTIVATION_ID_REQUIRED')
  }
  return String(env?.VERCEL_URL || '').trim() || 'local-development'
}

export function miniV2ExecutionActivationSha256(activationId) {
  const normalized = String(activationId || '').trim()
  if (!normalized) throw new Error('BOS_JOB_EXECUTION_ACTIVATION_ID_REQUIRED')
  return createHash('sha256').update(normalized).digest('hex')
}

export function miniV2ExecutionAllowed({
  env = process.env,
  productionTarget = false,
  canonicalProduction = false,
} = {}) {
  if (String(env?.[MINI_V2_EXECUTION_DISABLED_ENV] || '').trim().toLowerCase() === 'true') return false
  return !productionTarget || canonicalProduction
}

export function resolveBosJobTtlSeconds(job) {
  const metadata = job?.payload?.metadata
  const relationshipRef = String(metadata?.recruiting_relationship_ref || '').trim()
  const purpose = String(metadata?.recruiting_purpose || '').trim()
  return relationshipRef && purpose === 'RECRUITING_INTELLIGENCE'
    ? RECRUITING_BOS_JOB_TTL_SECONDS
    : BOS_JOB_TTL_SECONDS
}

/**
 * Job statuses
 */
export const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  FAILED: 'failed'
}

/**
 * Job stages (poll-driven)
 */
export const JOB_STAGE = {
  RECEIVED: 'received',
  FIRST_PASS_GENERATION: 'first_pass_generation',
  CANONICAL_GENERATION: 'canonical_generation',
  FIRST_INJECTION: 'first_injection',
  REPAIR_PASS: 'repair_pass',
  FINAL_INJECTION: 'final_injection',
  COMPLETE: 'complete',
  FAILED: 'failed'
}

/**
 * Create new job
 */
function payloadDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export async function createJob(payload, {
  jobId: providedJobId = null,
  activationId = resolveMiniV2ExecutionActivationId(),
} = {}) {
  const jobId = providedJobId || uuidv4()
  const now = new Date().toISOString()
  const intakePayloadSha256 = payloadDigest(payload)
  
  const job = {
    job_id: jobId,
    status: JOB_STATUS.QUEUED,
    stage: JOB_STAGE.RECEIVED,
    progress_message: 'Job queued',
    created_at: now,
    updated_at: now,
    locked: false,
    locked_at: null,
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: miniV2ExecutionActivationSha256(activationId),
    payload,
    intake_payload_sha256: intakePayloadSha256,
    profileInput: null,
    reportContent: null,
    firstSnapshot: null,
    missingFields: null,
    repairContent: null,
    result_html: null,
    result_metadata: {},
    error: null,
    diagnostics: {},
    canonical_diagnostics: {
      attempted: false,
      success: false,
      error: null,
      profile_id: null,
      vault_save_attempted: false,
      vault_save_success: false,
      vault_save_error: null,
      timestamp: null
    }
  }
  const ttlSeconds = resolveBosJobTtlSeconds(job)
  
  if (providedJobId) {
    const rc = getRedis()
    const created = await rc.set(`job:${jobId}`, JSON.stringify(job), 'EX', ttlSeconds, 'NX')
    if (created !== 'OK') {
      const existing = await redisGet(`job:${jobId}`)
      if (existing?.intake_payload_sha256 !== intakePayloadSha256) {
        throw new Error('BOS_JOB_IDEMPOTENCY_CONFLICT')
      }
      return jobId
    }
  } else {
    await redisSet(`job:${jobId}`, job, { ex: ttlSeconds })
  }
  
  // Add to recent jobs list for diagnostics
  try {
    const rc = getRedis()
    await rc.lpush('jobs:recent', jobId)
    await rc.ltrim('jobs:recent', 0, 49) // Keep last 50 jobs
  } catch {
    // Fail silently - index is optional for diagnostics only
  }
  
  return jobId
}

/**
 * Get job by ID
 */
export async function getJob(jobId) {
  return await redisGet(`job:${jobId}`)
}

/**
 * Update job with partial patch
 */
export async function updateJob(jobId, patch) {
  const job = await getJob(jobId)
  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }
  const ttlSeconds = resolveBosJobTtlSeconds(job)
  
  const updated = {
    ...job,
    ...patch,
    // Intake payload and its server-derived retention class are immutable.
    payload: job.payload,
    updated_at: new Date().toISOString()
  }
  
  await redisSet(`job:${jobId}`, updated, { ex: ttlSeconds })
  return updated
}

/**
 * Complete job successfully
 */
export async function completeJob(jobId, result) {
  return await updateJob(jobId, {
    status: JOB_STATUS.COMPLETE,
    stage: JOB_STAGE.COMPLETE,
    progress_message: 'Report ready',
    result_html: result.html,
    result_metadata: result.metadata || {},
    diagnostics: result.diagnostics || {}
  })
}

/**
 * Fail job with error
 */
export async function failJob(jobId, error) {
  return await updateJob(jobId, {
    status: JOB_STATUS.FAILED,
    stage: JOB_STAGE.FAILED,
    progress_message: 'Generation failed',
    error: error.message || String(error)
  })
}

/**
 * Set job stage with progress message
 */
export async function setJobStage(jobId, stage, progressMessage = null) {
  const update = {
    status: JOB_STATUS.PROCESSING,
    stage
  }
  
  if (progressMessage) {
    update.progress_message = progressMessage
  } else {
    update.progress_message = stageToMessage(stage)
  }
  
  return await updateJob(jobId, update)
}

/**
 * Lock job for execution
 */
export async function lockJob(jobId) {
  return await updateJob(jobId, {
    locked: true,
    locked_at: new Date().toISOString()
  })
}

/**
 * Unlock job
 */
export async function unlockJob(jobId) {
  return await updateJob(jobId, {
    locked: false,
    locked_at: null
  })
}

/**
 * Acquire a Redis-owned execution lease without rewriting the job document.
 * SET NX makes concurrent status requests mutually exclusive; the TTL bounds
 * recovery when a serverless invocation disappears mid-stage.
 */
export async function acquireJobExecutionLease(jobId, {
  redis = getRedis(),
  owner = uuidv4(),
  ttlMs = JOB_EXECUTION_LEASE_TTL_MS,
} = {}) {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId) throw new Error('BOS_JOB_EXECUTION_LEASE_JOB_ID_REQUIRED')
  if (!owner || !Number.isInteger(ttlMs) || ttlMs < 1000) {
    throw new Error('BOS_JOB_EXECUTION_LEASE_INVALID')
  }
  const acquired = await redis.set(`job-execution-lease:${normalizedJobId}`, owner, 'PX', ttlMs, 'NX')
  return acquired === 'OK' ? owner : null
}

/** Release only the lease owned by this invocation. */
export async function releaseJobExecutionLease(jobId, owner, { redis = getRedis() } = {}) {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId || !owner) return false
  const released = await redis.eval(
    "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
    1,
    `job-execution-lease:${normalizedJobId}`,
    owner,
  )
  return released === 1
}

/**
 * Establish an activation-scoped, Redis-server-timed drain barrier. Every
 * canonical v1-to-v2 activation waits the full outgoing function window before
 * any nonterminal job advances, including jobs whose forward-compatible v2
 * marker survived a rollback through v1.
 */
export async function ensureLegacyJobExecutionDrain({
  redis = getRedis(),
  drainMs = LEGACY_JOB_EXECUTION_DRAIN_MS,
  activationId = resolveMiniV2ExecutionActivationId(),
  key = null,
} = {}) {
  if (!Number.isInteger(drainMs) || drainMs < 1000) {
    throw new Error('BOS_LEGACY_JOB_EXECUTION_DRAIN_INVALID')
  }
  const drainKey = key || `${LEGACY_JOB_EXECUTION_DRAIN_KEY}:${miniV2ExecutionActivationSha256(activationId)}`
  const result = await redis.eval(
    "local t=redis.call('TIME'); local now=(tonumber(t[1])*1000)+math.floor(tonumber(t[2])/1000); local started=redis.call('GET',KEYS[1]); if not started then started=tostring(now); redis.call('SET',KEYS[1],started,'NX'); started=redis.call('GET',KEYS[1]); end; return {started,tostring(now)}",
    1,
    drainKey,
  )
  const startedAtMs = Number(result?.[0])
  const serverNowMs = Number(result?.[1])
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(serverNowMs) || serverNowMs < startedAtMs) {
    throw new Error('BOS_LEGACY_JOB_EXECUTION_DRAIN_RECEIPT_INVALID')
  }
  const ageMs = serverNowMs - startedAtMs
  return Object.freeze({
    ready: ageMs >= drainMs,
    age_ms: ageMs,
    retry_after_ms: Math.max(0, drainMs - ageMs),
  })
}

/**
 * Atomically publish the legacy job-document lock after the owner lease is
 * held. expectedLockedAt is a compare-and-set receipt from the immediately
 * preceding job read, so an intervening legacy writer cannot be overwritten.
 */
export async function claimLegacyJobExecutionLock(jobId, owner, {
  redis = getRedis(),
  expectedLockedAt = null,
  now = new Date(),
  activationId = resolveMiniV2ExecutionActivationId(),
} = {}) {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId || !owner) throw new Error('BOS_JOB_LEGACY_LOCK_INVALID')
  const acquiredAt = now.toISOString()
  const legacyVisibleUntil = new Date(now.getTime() + JOB_EXECUTION_LEASE_TTL_MS).toISOString()
  const activationSha256 = miniV2ExecutionActivationSha256(activationId)
  const result = await redis.eval(
    "if redis.call('GET',KEYS[2]) ~= ARGV[1] then return 0 end; local raw=redis.call('GET',KEYS[1]); if not raw then return -1 end; local job=cjson.decode(raw); local expected=ARGV[2]; if job.locked == true then if expected == '' or tostring(job.locked_at or '') ~= expected then return 0 end else if expected ~= '' then return 0 end end; job.locked=true; job.locked_at=ARGV[3]; job.execution_lock_acquired_at=ARGV[4]; job.execution_lock_owner=ARGV[1]; job.execution_lock_protocol_version=tonumber(ARGV[5]); job.execution_lock_activation_sha256=ARGV[6]; job.updated_at=ARGV[4]; redis.call('SET',KEYS[1],cjson.encode(job),'KEEPTTL'); return 1",
    2,
    `job:${normalizedJobId}`,
    `job-execution-lease:${normalizedJobId}`,
    owner,
    expectedLockedAt || '',
    legacyVisibleUntil,
    acquiredAt,
    String(JOB_EXECUTION_PROTOCOL_VERSION),
    activationSha256,
  )
  return result === 1
}

/** Clear the legacy bridge only while the same invocation still owns it. */
export async function releaseLegacyJobExecutionLock(jobId, owner, { redis = getRedis(), now = new Date() } = {}) {
  const normalizedJobId = String(jobId || '').trim()
  if (!normalizedJobId || !owner) return false
  const result = await redis.eval(
    "if redis.call('GET',KEYS[2]) ~= ARGV[1] then return 0 end; local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local job=cjson.decode(raw); if job.execution_lock_owner ~= ARGV[1] then return 0 end; job.locked=false; job.locked_at=cjson.null; job.execution_lock_acquired_at=cjson.null; job.execution_lock_owner=cjson.null; job.updated_at=ARGV[2]; redis.call('SET',KEYS[1],cjson.encode(job),'KEEPTTL'); return 1",
    2,
    `job:${normalizedJobId}`,
    `job-execution-lease:${normalizedJobId}`,
    owner,
    now.toISOString(),
  )
  return result === 1
}

/**
 * Check if job is stale locked (locked > 5 minutes)
 */
export function isStaleLock(job) {
  if (!job.locked || !job.locked_at) return false
  const lockedTime = new Date(job.locked_at)
  const now = new Date()
  const elapsedMs = now - lockedTime
  return elapsedMs > 300000 // 5 minutes
}

/**
 * Convert stage to user-friendly message
 */
function stageToMessage(stage) {
  const messages = {
    [JOB_STAGE.RECEIVED]: 'Starting generation...',
    [JOB_STAGE.FIRST_PASS_GENERATION]: 'Analyzing response patterns',
    [JOB_STAGE.CANONICAL_GENERATION]: 'Building canonical dossier',
    [JOB_STAGE.FIRST_INJECTION]: 'Building behavioral profile',
    [JOB_STAGE.REPAIR_PASS]: 'Refining missing sections',
    [JOB_STAGE.FINAL_INJECTION]: 'Preparing final report',
    [JOB_STAGE.COMPLETE]: 'Report ready',
    [JOB_STAGE.FAILED]: 'Generation failed'
  }
  return messages[stage] || 'Processing...'
}

/**
 * Format job for API response
 */
export function formatJobResponse(job) {
  if (!job) {
    return {
      success: false,
      error: 'Job not found'
    }
  }
  
  if (job.status === JOB_STATUS.COMPLETE) {
    return {
      success: true,
      status: 'complete',
      job_id: job.job_id,
      html: job.result_html,
      metadata: job.result_metadata,
      created_at: job.created_at,
      updated_at: job.updated_at,
      canonical_profile_id: job.canonical_profile_id || null
    }
  }
  
  if (job.status === JOB_STATUS.FAILED) {
    return {
      success: false,
      status: 'failed',
      job_id: job.job_id,
      error: 'Generation failed. Please try again.',
      stage: job.stage,
      created_at: job.created_at,
      updated_at: job.updated_at
    }
  }
  
  // Queued or processing
  return {
    success: true,
    status: job.status,
    job_id: job.job_id,
    stage: job.stage,
    progress_message: job.progress_message,
    created_at: job.created_at,
    updated_at: job.updated_at
  }
}
