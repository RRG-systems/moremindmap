/**
 * Mini V2 Async Job Status Endpoint
 * GET /api/moremindmap/mini-profile-v2-status?job_id=...
 * 
 * Returns job status. If queued and not started, advances generation.
 * This handles cases where background execution didn't continue after start response.
 */

import { getJob, formatJobResponse, lockJob, unlockJob, isStaleLock, JOB_STATUS, JOB_STAGE } from '../engine/miniV2JobManager.js'
import { executeNextStage } from '../engine/miniV2StagedExecutor.js'
import { redis as getRedis } from '../engine/redisClient.js'
import {
  authorizePublicOrRecruitingProductRequest,
  reconcileRecruitingBosReadyFromCompletedJob,
} from '../engine/recruitingV1/canonicalAdapters.js'
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js'
import { assertBosExecutionAuthority, bindBosProfileToGrant } from '../../src/lib/publicSiteAirlockV1/productBoundary.js'
import { applyExactOriginCors } from '../../src/lib/publicSiteAirlockV1/security.js'

async function reconcileCompletedBosBindings({ job, authority, store }) {
  const response = formatJobResponse(job)
  if (!response.success || !response.canonical_profile_id) return response
  await reconcileRecruitingBosReadyFromCompletedJob({
    redis: getRedis(),
    authority,
    job,
  })
  await bindBosProfileToGrant({
    store,
    jobId: job.job_id,
    profileId: response.canonical_profile_id,
  })
  return response
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Content-Type', 'application/json')
  if (!applyExactOriginCors(req, res, { methods: 'GET,OPTIONS' })) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { job_id } = req.query

    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: 'job_id required'
      })
    }

    // Read the server-owned job before authorizing so a Recruiting invite can
    // be compared with the exact relationship embedded at governed BOS start.
    // Unauthorized and missing jobs remain indistinguishable to the caller.
    let job = await getJob(job_id)

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      })
    }

    const publicStore = new RedisPublicStore(getRedis())
    const publicAuthority = await authorizePublicOrRecruitingProductRequest({
      req,
      store: publicStore,
      productKey: 'behavior_operating_system',
      relationshipRef: job.payload?.metadata?.recruiting_relationship_ref || '',
    })
    await assertBosExecutionAuthority({ store: publicStore, authority: publicAuthority, jobId: job_id })

    // If already complete or failed, return final result
    if (job.status === JOB_STATUS.COMPLETE || job.status === JOB_STATUS.FAILED) {
      const response = await reconcileCompletedBosBindings({ job, authority: publicAuthority, store: publicStore })
      return res.status(response.success ? 200 : 500).json(response)
    }

    // Check if job is locked by another poll
    if (job.locked) {
      if (isStaleLock(job)) {
        // Stale lock, unlock and proceed
        console.log('[MINI-V2-STATUS] Releasing stale job lock')
        await unlockJob(job_id)
        job = await getJob(job_id)
      } else {
        // Recently locked, another poll is processing
        return res.status(200).json(formatJobResponse(job))
      }
    }

    // Job is ready to advance - lock it
    await lockJob(job_id)
    job = await getJob(job_id)

    try {
      // Execute next stage
      await executeNextStage(job)
      
      // Unlock job
      await unlockJob(job_id)
      
      // Reload job to get updated state
      job = await getJob(job_id)
      
      // Return current status
      const response = await reconcileCompletedBosBindings({ job, authority: publicAuthority, store: publicStore })
      return res.status(response.success ? 200 : 500).json(response)
    } catch {
      // Unlock on error
      await unlockJob(job_id)
      
      console.error('[MINI-V2-STATUS] Stage execution failed')
      
      // Reload job (may have error state)
      job = await getJob(job_id)
      
      const response = formatJobResponse(job)
      return res.status(500).json(response)
    }
  } catch (error) {
    if (/public_product_/u.test(error?.message || '')) {
      return res.status(404).json({ success: false, error: 'Job not found' })
    }
    console.error('[MINI-V2-STATUS] Request failed')
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
