/**
 * Mini V2 Async Job Start Endpoint
 * POST /api/moremindmap/mini-profile-v2-start
 * 
 * Accepts assessment answers, creates job, returns job_id immediately
 */

import { createHash } from 'node:crypto'

import { createJob, getJob } from '../engine/miniV2JobManager.js'
import { createBosIntakeDraftStore, normalizeBosIntakeDraftSnapshot } from '../engine/bosIntakeDraftV1.js'
import { redis as getRedis } from '../engine/redisClient.js'
import {
  authorizePublicOrRecruitingProductRequest,
  resolveRecruitingBosStartMetadata,
} from '../engine/recruitingV1/canonicalAdapters.js'
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js'
import {
  assertBosExecutionAuthority,
  bindBosJobToGrant,
  claimProductExecution,
  commitProductExecution,
  deterministicExecutionUuid,
  productExecutionFingerprint,
  releaseProductExecution,
} from '../../src/lib/publicSiteAirlockV1/productBoundary.js'
import { applyExactOriginCors } from '../../src/lib/publicSiteAirlockV1/security.js'

export async function createBosStartJob(jobPayload, { jobId = null, create = createJob } = {}) {
  return create(jobPayload, jobId ? { jobId } : undefined)
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Content-Type', 'application/json')
  if (!applyExactOriginCors(req, res, { methods: 'POST,OPTIONS' })) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let publicStore
  let executionClaim
  try {
    publicStore = new RedisPublicStore(getRedis())
    const publicAuthority = await authorizePublicOrRecruitingProductRequest({
      req,
      store: publicStore,
      productKey: 'behavior_operating_system',
      allowUnboundBosStart: true,
    })
    const { answers, metadata = {}, draft_reference: draftReference = null } = req.body

    // Validate answers
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: answers required'
      })
    }

    // Quick validation: answers should have entries
    const answerCount = Object.keys(answers).length
    if (answerCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: no answers provided'
      })
    }

    // Format answers for backend compatibility
    // Backend expects: { qN: { choice: 'A' } } or { qN: { text: 'written response' } }
    // Frontend may send: { N: 'A' } or { N: 'written response' }
    const formattedAnswers = {}
    Object.keys(answers).forEach(key => {
      const qKey = key.startsWith('q') ? key : `q${key}`
      const value = answers[key]
      
      // Detect if it's a written response (long text) or multiple choice (single letter)
      if (typeof value === 'string' && value.length === 1 && /[A-E]/i.test(value)) {
        // Multiple choice
        formattedAnswers[qKey] = { choice: value.toUpperCase() }
      } else if (typeof value === 'object' && (value.choice || value.text)) {
        // Already formatted
        formattedAnswers[qKey] = value
      } else {
        // Written response
        formattedAnswers[qKey] = { text: String(value) }
      }
    })

    let claimedDraft = null
    if (draftReference) {
      const resumeToken = String(req.headers['x-bos-draft-token'] || '').trim()
      if (!resumeToken) {
        return res.status(400).json({ success: false, code: 'BOS_DRAFT_TOKEN_REQUIRED', error: 'Your saved assessment could not be verified.' })
      }
      const snapshot = normalizeBosIntakeDraftSnapshot(draftReference.snapshot)
      const store = createBosIntakeDraftStore({ redis: getRedis() })
      claimedDraft = await store.claimSubmission({
        draftId: String(draftReference.draft_id || ''),
        resumeToken,
        revision: draftReference.revision,
        snapshot,
        submission: { answers, metadata }
      })
      if (!['CLAIMED', 'IDEMPOTENT_REPLAY'].includes(claimedDraft.code)) {
        const status = claimedDraft.code === 'STALE_REVISION' ? 409 : 400
        return res.status(status).json({
          success: false,
          code: `BOS_DRAFT_${claimedDraft.code}`,
          error: claimedDraft.code === 'STALE_REVISION'
            ? 'A newer saved version exists. Restore it before submitting.'
            : 'Your saved assessment did not match this submission.'
        })
      }
    }

    const governedMetadata = await resolveRecruitingBosStartMetadata(
      req,
      metadata,
      undefined,
      { authority: publicAuthority },
    )

    const jobPayload = {
      answers: formattedAnswers,
      metadata: {
        ...governedMetadata,
        public_product_grant_id: publicAuthority.grant?.grant_id || null,
        bos_intake_draft: claimedDraft
          ? {
              contract_version: 'bos_intake_draft_v1',
              draft_id: draftReference.draft_id,
              revision: draftReference.revision
            }
          : null
      }
    }
    const requestSha256 = productExecutionFingerprint('behavior_operating_system', jobPayload)
    const authorityRef = publicAuthority.grant?.grant_id || publicAuthority.relationship_ref || ''
    const proposedJobId = claimedDraft?.job_id || (authorityRef
      ? deterministicExecutionUuid({
          authorityRef,
          productKey: 'behavior_operating_system',
          requestSha256,
          kind: 'job',
        })
      : null)
    executionClaim = await claimProductExecution({
      store: publicStore,
      authority: publicAuthority,
      productKey: 'behavior_operating_system',
      requestSha256,
      identifiers: { job_id: proposedJobId },
    })
    let jobId = executionClaim.record?.identifiers?.job_id || proposedJobId
    const startResultFor = (id) => ({
      success: true,
      job_id: id,
      status: 'queued',
      message: 'Report generation queued. Poll /api/moremindmap/status?job_id=' + id
    })
    if (executionClaim.code === 'REPLAY') {
      await assertBosExecutionAuthority({ store: publicStore, authority: publicAuthority, jobId })
      const existingJob = await getJob(jobId)
      const expectedPayloadSha256 = createHash('sha256').update(JSON.stringify(jobPayload)).digest('hex')
      if (!existingJob || existingJob.intake_payload_sha256 !== expectedPayloadSha256) {
        throw new Error('public_product_execution_artifact_mismatch')
      }
      return res.status(200).json(executionClaim.record.result || startResultFor(jobId))
    }
    if (executionClaim.code === 'IN_PROGRESS') return res.status(200).json(startResultFor(jobId))

    // The execution claim chooses one job identity before the job write. A
    // partial failure can therefore retry this exact payload without forking.
    jobId = await createBosStartJob(jobPayload, { jobId })
    const startResult = startResultFor(jobId)

    await bindBosJobToGrant({ store: publicStore, grant: publicAuthority.grant, jobId })

    await commitProductExecution({ store: publicStore, claim: executionClaim, result: startResult })

    // Return immediately - status endpoint will drive execution
    return res.status(200).json(startResult)
  } catch (error) {
    if (publicStore && executionClaim?.code === 'ACQUIRED') {
      try { await releaseProductExecution({ store: publicStore, claim: executionClaim }) } catch { /* lease expiry remains a recovery path */ }
    }
    console.error(JSON.stringify({ event: 'MINI_V2_START_FAILED', code: 'START_REQUEST_FAILED', customer_payload_logged: false }))
    if (/public_product_/u.test(error?.message || '')) {
      return res.status(403).json({ success: false, error: 'Product access could not be verified.' })
    }
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
