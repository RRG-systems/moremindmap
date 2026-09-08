export const BOS_GENERATION_MAX_WAIT_MS = 10 * 60 * 1000
export const BOS_GENERATION_POLL_INTERVAL_MS = 3000
export const BOS_GENERATION_STATUS_FAILURE_LIMIT = 5
export const BOS_GENERATION_REQUEST_TIMEOUT_MS = 30 * 1000

const BOS_CANONICAL_PROFILE_ID_PATTERN = /^mm-\d{8}-[a-z0-9]{8}$/u

function compactText(value, fallback = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 180) : fallback
}

export function normalizeBosCanonicalProfileId(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return BOS_CANONICAL_PROFILE_ID_PATTERN.test(normalized) ? normalized : ''
}

export function hasUsableBosCompletedHtml(payload) {
  return typeof payload?.html === 'string' && payload.html.trim().length > 0
}

export async function runBosGenerationRequest({
  request,
  timeoutMs = BOS_GENERATION_REQUEST_TIMEOUT_MS,
} = {}) {
  if (typeof request !== 'function') throw new TypeError('request is required')

  const boundedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : BOS_GENERATION_REQUEST_TIMEOUT_MS
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  let timeoutId
  const requestOutcome = Promise.resolve()
    .then(() => request({ signal: controller?.signal }))
    .then(
      (value) => ({ kind: 'response', value }),
      (error) => ({ kind: 'error', error }),
    )
  const waitExpired = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ kind: 'wait_expired' })
      controller?.abort()
    }, boundedTimeoutMs)
  })
  const outcome = await Promise.race([requestOutcome, waitExpired])
  clearTimeout(timeoutId)

  if (outcome.kind === 'wait_expired') {
    const error = new Error('BOS generation request timed out')
    error.code = 'BOS_GENERATION_REQUEST_TIMEOUT'
    throw error
  }
  if (outcome.kind === 'error') throw outcome.error
  return outcome.value
}

export function createBosSubmissionGuard() {
  let active = false

  return Object.freeze({
    tryStart() {
      if (active) return false
      active = true
      return true
    },
    finish() {
      active = false
    },
    isActive() {
      return active
    },
  })
}

export function classifyBosGenerationStatus(response) {
  const payload = response?.payload && typeof response.payload === 'object' && !Array.isArray(response.payload)
    ? response.payload
    : null

  // The status endpoint intentionally returns a non-2xx response for a failed
  // job. Read the governed job state before classifying the transport status.
  if (payload?.status === 'failed') {
    return {
      state: 'failed',
      error: compactText(payload.error, 'Generation stopped before your BOS was ready.'),
    }
  }

  if (payload?.status === 'complete') {
    const canonicalProfileId = normalizeBosCanonicalProfileId(payload.canonical_profile_id)
    if (response?.ok !== true || payload.success !== true || !canonicalProfileId) {
      return { state: 'status_unavailable' }
    }
    return {
      state: 'complete',
      payload: {
        ...payload,
        canonical_profile_id: canonicalProfileId,
      },
    }
  }

  if (response?.ok !== true || !payload) {
    return { state: 'status_unavailable' }
  }

  return {
    state: 'pending',
    stage: compactText(payload.stage, 'processing'),
    message: compactText(payload.progress_message, 'Your saved generation job is still processing.'),
  }
}

export async function pollBosGenerationJob({
  readStatus,
  onProgress = () => {},
  now = () => Date.now(),
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxWaitMs = BOS_GENERATION_MAX_WAIT_MS,
  pollIntervalMs = BOS_GENERATION_POLL_INTERVAL_MS,
  statusFailureLimit = BOS_GENERATION_STATUS_FAILURE_LIMIT,
} = {}) {
  if (typeof readStatus !== 'function') throw new TypeError('readStatus is required')

  const startedAt = now()
  let consecutiveStatusFailures = 0

  while ((now() - startedAt) < maxWaitMs) {
    const remainingMs = maxWaitMs - (now() - startedAt)
    await sleep(Math.min(pollIntervalMs, remainingMs))

    const statusReadBudgetMs = maxWaitMs - (now() - startedAt)
    if (statusReadBudgetMs <= 0) break

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    let timeoutId
    const statusRead = Promise.resolve()
      .then(() => readStatus({ signal: controller?.signal }))
      .then(
        (response) => ({ kind: 'response', response }),
        () => ({ kind: 'response', response: { ok: false, payload: null } }),
      )
    const waitExpired = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        controller?.abort()
        resolve({ kind: 'wait_expired' })
      }, statusReadBudgetMs)
    })
    const readOutcome = await Promise.race([statusRead, waitExpired])
    clearTimeout(timeoutId)
    if (readOutcome.kind === 'wait_expired') break

    const status = classifyBosGenerationStatus(readOutcome.response)
    if (status.state === 'complete' || status.state === 'failed') return status

    if (status.state === 'status_unavailable') {
      consecutiveStatusFailures += 1
      if (consecutiveStatusFailures >= statusFailureLimit) {
        return {
          state: 'status_unavailable',
          retryable: true,
        }
      }
      continue
    }

    consecutiveStatusFailures = 0
    onProgress(status)
  }

  return {
    state: 'slow',
    retryable: true,
  }
}
