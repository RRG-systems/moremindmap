const endpoint = '/api/internal/athlete-living-consult-one-shot-v1';
const stateHash = /^[a-f0-9]{64}$/u;
const actorRoles = ['athlete','instructor','shared_editor','conversation'];
const reviewChanged = () => Error('STATE_CHANGED_RELOAD');
const scopeChanged = () => Error('Your selected athlete or access changed. Reopen through Leadership and review before choosing again.');

function validReviewedState(state, slug) {
  const proof = state?._transport;
  return state && proof && proof.slug === slug && ['nia','sofia'].includes(slug)
    && typeof proof.mm === 'string' && proof.mm.length > 0 && state.mm === proof.mm
    && stateHash.test(proof.bos || '') && stateHash.test(proof.apa || '')
    && stateHash.test(proof.state_hash || '')
    && Number.isSafeInteger(state.revision) && state.revision >= 0
    && proof.revision === state.revision
    && proof.actors && Object.keys(proof.actors).length === actorRoles.length
    && actorRoles.every(role => typeof proof.actors[role] === 'string' && proof.actors[role].length > 0);
}

// Renew this outer view's own one-use proof before an intentional mutation.
// Never import an iframe proof, extend expiry, silently rebase, or retry a POST.
export async function apiWithStatePreflight(path, body, reviewedState, isStillSelected = () => true) {
  const [kind, slug, extra] = String(path).split('/');
  let intended, reviewed, submitted = false;
  try {
    if (!['action','transcribe'].includes(kind) || extra !== undefined || !body
      || typeof isStillSelected !== 'function' || !isStillSelected()
      || !validReviewedState(reviewedState, slug)) throw scopeChanged();
    // Capture the exact intent, target, request ID and authority before reading.
    intended = structuredClone(body);
    reviewed = { mm: reviewedState.mm, revision: reviewedState.revision,
      sessionId: reviewedState.sessionId, _transport: structuredClone(reviewedState._transport) };
    const fresh = await api('state/'+slug);
    if (!isStillSelected() || !validReviewedState(fresh, slug)
      || ['slug','mm','bos','apa'].some(key => fresh._transport[key] !== reviewed._transport[key])
      || fresh.sessionId !== reviewed.sessionId
      || actorRoles.some(role => fresh._transport.actors[role] !== reviewed._transport.actors[role]))
      throw scopeChanged();
    if (fresh.revision !== reviewed.revision
      || fresh._transport.state_hash !== reviewed._transport.state_hash) throw reviewChanged();
    if (typeof fresh._transport.csrf !== 'string' || fresh._transport.csrf.length < 32)
      throw scopeChanged();
    // Equality is established before api builds the role-bound request body.
    // A later race is still rejected by the server's normal revision gate.
    submitted = true;
    return await api(path, intended, fresh._transport);
  } catch (error) {
    // Only renewal/validation errors are known not to have submitted anything.
    // A POST transport failure remains uncertain and is never automatically retried.
    const failure = error instanceof Error ? error : Error('The saved view could not be refreshed. Review it before choosing again.');
    if (!submitted) {
      failure.before_mutation = true;
      if (failure.message !== 'STATE_CHANGED_RELOAD' && !failure.message.includes('review before choosing again'))
        failure.message = failure.message.includes('shared Leadership gate')
          ? 'Please enter through the shared Leadership gate, then review before choosing again.'
          : 'The saved view could not be refreshed. Review it before choosing again.';
    }
    throw failure;
  }
}
export async function api(path, body, proof) {
  const [kind, slug] = path.split('/');
  const query = new URLSearchParams({ kind, ...(slug ? { athlete: slug } : {}) });
  let requestBody = body;
  if (body) {
    const role = body.action === 'transcribe_coach_voice' ? 'instructor'
      : body.action === 'capture_demo' ? body.capture?.role === 'coach' ? 'instructor' : 'athlete'
      : body.action === 'approve' ? body.actor === 'athlete' ? 'athlete' : 'instructor'
      : ['draft','discard','reset'].includes(body.action) ? 'shared_editor'
        : ['feedback','remember','forget','finish','confirm_fact','update_apa','publish_apa','discard_apa'].includes(body.action) ? 'athlete' : 'conversation';
    if (!proof?.actors?.[role]) throw Error('Reopen through Leadership to continue.');
    requestBody = {...body, revision:proof.revision, actor_capability:proof.actors[role], state_hash:proof.state_hash, proof_revision:proof.revision};
  }
  const response = await fetch(`${endpoint}?${query}`, {credentials:'same-origin',cache:'no-store',...(body ? {
    method:'POST',headers:{'Content-Type':'application/json','x-athlete-consulting-csrf':proof.csrf},body:JSON.stringify(requestBody),
  } : {})});
  const value = await response.json();
  if (!response.ok) {
    const error = Error(response.status === 401 ? 'Please enter through the shared Leadership gate.' : value.error || 'Please try again.');
    if (response.status === 503 && value.error === 'VOICE_TRANSCRIPTION_FAILED'
      && /^[a-f0-9-]{36}$/u.test(value.diagnostic?.attempt_id || '')) error.voice_diagnostic_id = value.diagnostic.attempt_id;
    throw error;
  }
  return value;
}
