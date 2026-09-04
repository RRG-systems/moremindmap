// A long coaching turn may outlive a five-minute one-time proof. Refresh only
// through the existing authenticated GET; never adopt another tab's arm/view.
export async function prepareBlindDemoRequestProof({ fetchImpl = fetch, blind, kind, sessionId = null }) {
  if (!blind || !['1', '2'].includes(blind.selection) || typeof blind.view_token !== 'string'
    || !blind.view_token || !['runtime', 'selection'].includes(kind)) {
    throw new Error('BLIND_DEMO_PROOF_CONTEXT_REQUIRED')
  }
  const response = await fetchImpl('/api/internal/subscription-v1-runtime', {
    credentials: 'same-origin', cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok !== true) {
    const failure = new Error('BLIND_DEMO_PROOF_REFRESH_DENIED')
    failure.status = response.status
    failure.reentryRequired = body?.reentry_required === true
    throw failure
  }
  if (body.blind_demo?.selection !== blind.selection || body.blind_demo?.view_token !== blind.view_token) {
    throw new Error('BLIND_DEMO_VIEW_STALE')
  }
  if (sessionId && body.session?.session_id !== sessionId) throw new Error('BLIND_DEMO_SESSION_STALE')
  const proof = kind === 'selection' ? body.blind_demo.selection_csrf : body.csrf_token
  if (typeof proof !== 'string' || proof.length < 32) throw new Error('BLIND_DEMO_PROOF_UNAVAILABLE')
  return proof
}
