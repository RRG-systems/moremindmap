/**
 * Mini V2 Async Job Status Endpoint
 * GET /api/moremindmap/mini-profile-v2-status?job_id=...
 * 
 * Returns job status. If queued and not started, advances generation.
 * This handles cases where background execution didn't continue after start response.
 */

/* global process */

import { getJob, formatJobResponse, JOB_STATUS, miniV2ExecutionAllowed } from '../engine/miniV2JobManager.js'
import { advanceMiniV2JobOnce } from '../engine/miniV2JobAdvancer.js'
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

function canonicalProductionRequest(req, env = process.env) {
  // Host is the platform-routed destination. Forwarded values are not
  // sufficient authority to open the canonical execution transition gate.
  const host = String(req.headers?.host || '').split(',')[0].trim().toLowerCase()
  return String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production' && host === 'moremindmap.com'
}

function productionTargetRequest(env = process.env) {
  return String(env.VERCEL_ENV || '').trim().toLowerCase() === 'production'
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
    const authorizeJob = async (currentJob) => {
      const authority = await authorizePublicOrRecruitingProductRequest({
        req,
        store: publicStore,
        productKey: 'behavior_operating_system',
        relationshipRef: currentJob.payload?.metadata?.recruiting_relationship_ref || '',
      })
      await assertBosExecutionAuthority({ store: publicStore, authority, jobId: job_id })
      return authority
    }
    let publicAuthority = await authorizeJob(job)

    // If already complete or failed, return final result
    if (job.status === JOB_STATUS.COMPLETE || job.status === JOB_STATUS.FAILED) {
      const response = await reconcileCompletedBosBindings({ job, authority: publicAuthority, store: publicStore })
      return res.status(response.success ? 200 : 500).json(response)
    }

    try {
      const canonicalProduction = canonicalProductionRequest(req)
      const advanced = await advanceMiniV2JobOnce({
        jobId: job_id,
        allowLegacyDrainStart: canonicalProduction,
        executionAllowed: miniV2ExecutionAllowed({
          productionTarget: productionTargetRequest(),
          canonicalProduction,
        }),
        beforeExecute: async (currentJob) => { publicAuthority = await authorizeJob(currentJob) },
      })
      job = advanced.job
      
      // Return current status
      const response = await reconcileCompletedBosBindings({ job, authority: publicAuthority, store: publicStore })
      return res.status(response.success ? 200 : 500).json(response)
    } catch (error) {
      if (/public_product_|RECRUITING_/u.test(String(error?.message || ''))) throw error
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
