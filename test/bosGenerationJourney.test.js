import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  BOS_GENERATION_MAX_WAIT_MS,
  classifyBosGenerationStatus,
  createBosSubmissionGuard,
  hasUsableBosCompletedHtml,
  normalizeBosCanonicalProfileId,
  pollBosGenerationJob,
  runBosGenerationRequest,
} from '../src/lib/bosGenerationJourney.js'

test('pending updates use only confirmed server status and complete with the canonical Profile ID', async () => {
  const responses = [
    {
      ok: true,
      payload: {
        status: 'processing',
        stage: 'canonical_generation',
        progress_message: 'Building canonical dossier',
      },
    },
    {
      ok: true,
      payload: {
        success: true,
        status: 'complete',
        canonical_profile_id: ' MM-20990101-DEMO0001 ',
      },
    },
  ]
  const progress = []
  let clock = 0

  const outcome = await pollBosGenerationJob({
    readStatus: async () => responses.shift(),
    onProgress: (status) => progress.push(status),
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds },
    maxWaitMs: 30,
    pollIntervalMs: 3,
  })

  assert.equal(outcome.state, 'complete')
  assert.equal(outcome.payload.canonical_profile_id, 'mm-20990101-demo0001')
  assert.deepEqual(progress, [{
    state: 'pending',
    stage: 'canonical_generation',
    message: 'Building canonical dossier',
  }])
})

test('complete status fails closed unless transport, success, and canonical Profile ID all validate', () => {
  const valid = classifyBosGenerationStatus({
    ok: true,
    payload: {
      success: true,
      status: 'complete',
      canonical_profile_id: ' MM-20990101-DEMO0001 ',
    },
  })
  assert.equal(valid.state, 'complete')
  assert.equal(valid.payload.canonical_profile_id, 'mm-20990101-demo0001')

  for (const response of [
    {
      ok: false,
      payload: { success: true, status: 'complete', canonical_profile_id: 'mm-20990101-demo0001' },
    },
    {
      ok: true,
      payload: { status: 'complete', canonical_profile_id: 'mm-20990101-demo0001' },
    },
    {
      ok: true,
      payload: { success: true, status: 'complete', canonical_profile_id: 'not-a-profile-id' },
    },
  ]) {
    assert.deepEqual(classifyBosGenerationStatus(response), { state: 'status_unavailable' })
  }

  assert.equal(normalizeBosCanonicalProfileId(' MM-20990101-DEMO0001 '), 'mm-20990101-demo0001')
  assert.equal(normalizeBosCanonicalProfileId('job-20990101-demo0001'), '')
})

test('completed job HTML is usable only when it is a non-empty string', () => {
  assert.equal(hasUsableBosCompletedHtml({ html: '<main>Saved BOS</main>' }), true)
  assert.equal(hasUsableBosCompletedHtml({ html: '   ' }), false)
  assert.equal(hasUsableBosCompletedHtml({ html: null }), false)
})

test('a failed job is recognized even when the status endpoint returns non-2xx', async () => {
  const classified = classifyBosGenerationStatus({
    ok: false,
    statusCode: 500,
    payload: {
      success: false,
      status: 'failed',
      error: 'Generation failed. Please try again.',
    },
  })

  assert.deepEqual(classified, {
    state: 'failed',
    error: 'Generation failed. Please try again.',
  })
})

test('slow generation exits the truthful bounded wait and remains retryable', async () => {
  let clock = 0
  let reads = 0
  const progress = []

  const outcome = await pollBosGenerationJob({
    readStatus: async () => {
      reads += 1
      return {
        ok: true,
        payload: {
          status: 'processing',
          stage: 'repair_pass',
          progress_message: 'Refining missing sections',
        },
      }
    },
    onProgress: (status) => progress.push(status.message),
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds },
    maxWaitMs: 10,
    pollIntervalMs: 3,
  })

  assert.deepEqual(outcome, { state: 'slow', retryable: true })
  assert.equal(clock, 10)
  assert.equal(reads, 3)
  assert.deepEqual(new Set(progress), new Set(['Refining missing sections']))
})

test('repeated status transport failures stop promptly instead of leaving a permanent wait', async () => {
  let clock = 0
  let reads = 0

  const outcome = await pollBosGenerationJob({
    readStatus: async () => {
      reads += 1
      throw new Error('synthetic network failure')
    },
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds },
    maxWaitMs: 100,
    pollIntervalMs: 2,
    statusFailureLimit: 3,
  })

  assert.deepEqual(outcome, { state: 'status_unavailable', retryable: true })
  assert.equal(reads, 3)
  assert.equal(clock, 6)
})

test('polling cancellation stops before another status read', async () => {
  let active = true
  let reads = 0
  let clock = 0

  const outcome = await pollBosGenerationJob({
    readStatus: async () => {
      reads += 1
      return { ok: true, payload: { status: 'processing' } }
    },
    shouldContinue: () => active,
    now: () => clock,
    sleep: async (milliseconds) => {
      clock += milliseconds
      active = false
    },
    maxWaitMs: 100,
    pollIntervalMs: 3,
  })

  assert.deepEqual(outcome, { state: 'cancelled', retryable: true })
  assert.equal(reads, 0)
})

test('an in-flight status request is aborted at the overall customer wait boundary', async () => {
  let aborted = false

  const outcome = await pollBosGenerationJob({
    readStatus: ({ signal }) => new Promise((resolve) => {
      signal?.addEventListener('abort', () => {
        aborted = true
        resolve({ ok: false, payload: null })
      }, { once: true })
    }),
    maxWaitMs: 20,
    pollIntervalMs: 1,
  })

  assert.deepEqual(outcome, { state: 'slow', retryable: true })
  assert.equal(aborted, true)
})

test('a bounded BOS request aborts a hanging start or profile retrieval', async () => {
  let aborted = false

  await assert.rejects(
    runBosGenerationRequest({
      request: ({ signal }) => new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          aborted = true
          resolve('late response')
        }, { once: true })
      }),
      timeoutMs: 10,
    }),
    (error) => error?.code === 'BOS_GENERATION_REQUEST_TIMEOUT',
  )

  assert.equal(aborted, true)
})

test('submission guard prevents double start while allowing status recovery after settlement', () => {
  const guard = createBosSubmissionGuard()

  assert.equal(guard.tryStart(), true)
  assert.equal(guard.tryStart(), false)
  assert.equal(guard.isActive(), true)
  guard.finish()
  assert.equal(guard.isActive(), false)
  assert.equal(guard.tryStart(), true)
})

test('Profile renders waiting, custody, and status-only recovery contracts', () => {
  const source = fs.readFileSync('src/Profile.jsx', 'utf8')
  const openStart = source.indexOf('async function openCompletedBos')
  const pollStart = source.indexOf('async function pollExistingBosJob')
  const resumeStart = source.indexOf('async function resumeExistingGeneration')
  const retryStart = source.indexOf('function retryBosGenerationStart')
  const submitStart = source.indexOf('async function submitAssessment')
  const submitEnd = source.indexOf('const handlePage0AComplete')
  const openSource = source.slice(openStart, pollStart)
  const resumeSource = source.slice(resumeStart, submitStart)
  const retrySource = source.slice(retryStart, submitStart)
  const submitSource = source.slice(submitStart, submitEnd)

  assert.equal(BOS_GENERATION_MAX_WAIT_MS, 10 * 60 * 1000)
  assert.match(source, /We’re creating your Behavioral Operating System\./u)
  assert.match(source, /may take up to 10 minutes/u)
  assert.match(source, /your MORE reference number/u)
  assert.match(source, /does not by itself prove ownership/u)
  assert.match(source, /Copy Profile ID/u)
  assert.match(source, /Continue to your complimentary Business Assessment/u)
  assert.doesNotMatch(source, /Analyzing behavioral patterns…/u)
  assert.match(openSource, /runBosGenerationRequest/u)
  assert.match(openSource, /hasUsableBosCompletedHtml/u)
  assert.match(openSource, /BOS_COMPLETED_PROFILE_UNAVAILABLE/u)
  assert.match(resumeSource, /pollExistingBosJob\(jobId, API, \{ recruiting, isCancelled \}\)/u)
  assert.match(source, /shouldContinue: \(\) => !isCancelled\(\)/u)
  assert.match(resumeSource, /publicBosAuthorized\) await renewStoredPublicStartToken\(\)/u)
  assert.doesNotMatch(resumeSource, /\/api\/moremindmap\/start/u)
  assert.match(retrySource, /submitAssessment\(\{ reuseSavedSubmission: true \}\)/u)
  assert.match(submitSource, /reuseSavedSubmission\s*\? savedSubmissionEnvelope/u)
  assert.match(submitSource, /runBosGenerationRequest/u)
  assert.match(source, /Check the same generation job/u)
  assert.match(source, /Try generation again/u)
  assert.match(source, /same saved assessment to try generation again\. It does not submit a second assessment\./u)
  assert.match(source, /This generation job is final, so checking its status again will not restart it\./u)
})
