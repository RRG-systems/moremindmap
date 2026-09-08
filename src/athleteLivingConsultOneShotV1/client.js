export const ATHLETE_LIVING_CONSULT_ONE_SHOT_API = '/api/internal/athlete-living-consult-one-shot-v1'

function fixtureUrl(fixtureId) {
  const url = new URL(ATHLETE_LIVING_CONSULT_ONE_SHOT_API, window.location.origin)
  url.searchParams.set('fixture', fixtureId)
  return `${url.pathname}${url.search}`
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.ok !== true) {
    const error = new Error(payload?.code || 'ATHLETE_LIVING_CONSULT_ONE_SHOT_REQUEST_FAILED')
    error.payload = payload
    throw error
  }
  return payload
}

export async function fetchAthleteLivingConsultOneShot(fixtureId = 'mika') {
  const response = await fetch(fixtureUrl(fixtureId), {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
  return readJsonResponse(response)
}

export async function postAthleteLivingConsultOneShot({ fixtureId = 'mika', csrfToken, body, onProgress = null }) {
  const response = await fetch(fixtureUrl(fixtureId), {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      accept: body.action === 'TURN' ? 'application/x-ndjson, application/json' : 'application/json',
      'content-type': 'application/json',
      'x-athlete-living-consult-csrf': csrfToken,
    },
    body: JSON.stringify({ ...body, fixture_id: fixtureId }),
  })

  if (!response.headers.get('content-type')?.startsWith('application/x-ndjson')) return readJsonResponse(response)
  if (!response.ok || !response.body) throw new Error('ATHLETE_LIVING_CONSULT_ONE_SHOT_PROGRESSIVE_RESPONSE_INVALID')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalPayload = null
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const payload = JSON.parse(line)
      if (payload.ok !== true) {
        const error = new Error(payload.code || 'ATHLETE_LIVING_CONSULT_ONE_SHOT_PROGRESSIVE_FAILED')
        error.payload = payload
        throw error
      }
      if (payload.phase === 'COACHING_READY') onProgress?.(payload)
      finalPayload = payload
    }
    if (done) break
  }
  if (buffer.trim()) {
    const payload = JSON.parse(buffer)
    if (payload.ok !== true) {
      const error = new Error(payload.code || 'ATHLETE_LIVING_CONSULT_ONE_SHOT_PROGRESSIVE_FAILED')
      error.payload = payload
      throw error
    }
    if (payload.phase === 'COACHING_READY') onProgress?.(payload)
    finalPayload = payload
  }
  if (!finalPayload || finalPayload.phase === 'COACHING_READY' || !finalPayload.csrf_token) {
    throw new Error('ATHLETE_LIVING_CONSULT_ONE_SHOT_PROGRESSIVE_TERMINAL_REQUIRED')
  }
  return finalPayload
}
