import { useEffect, useState } from 'react';

const initialState = Object.freeze({
  status: 'DETACHED',
  runtimeReady: false,
  attachmentSet: null,
  projections: null,
});

export default function PrivateRuntimeAttachmentHost({
  entitlement,
  endpoint = '/api/internal/private-runtime-bootstrap',
  onAttachmentState = null,
}) {
  const [state, setState] = useState(initialState);
  const eligible = entitlement?.source === 'temporary_internal_subscription_entitlement';

  useEffect(() => {
    let cancelled = false;
    if (!eligible) return () => { cancelled = true; };
    void fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: 'ATTACH_CURRENT_AUTHENTICATED_SCOPE' }),
    })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (cancelled) return;
        const next = response.ok && result.runtime_ready === true
          ? {
            status: 'ATTACHED',
            runtimeReady: true,
            attachmentSet: result.attachment_set || null,
            projections: result.projections || null,
          }
          : initialState;
        setState(next);
        onAttachmentState?.(next);
      })
      .catch(() => {
        if (!cancelled) {
          setState(initialState);
          onAttachmentState?.(initialState);
        }
      });
    return () => { cancelled = true; };
  }, [eligible, endpoint, onAttachmentState]);

  if (!eligible) return null;
  const displayState = state.status === 'DETACHED'
    ? { ...initialState, status: 'ATTACHING' }
    : state;
  const coachConnectAttached = displayState.attachmentSet?.coach_connect_attachment_ref != null;
  return (
    <section
      className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-950/20 p-5 text-white"
      data-region="coach-connect-private-runtime"
      aria-live="polite"
    >
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
        Private Subscription Runtime
      </h2>
      <p className="mt-2 text-sm text-white/65">
        {displayState.runtimeReady
          ? `Your authenticated Business Engine, subscription runtime${coachConnectAttached ? ', and text-based Coach Connect' : ''} are attached.`
          : 'Attaching your authenticated subscription runtime…'}
      </p>
    </section>
  );
}
