const endpoint = '/api/internal/athlete-living-consult-one-shot-v1';
export async function api(path, body, proof) {
  const [kind, slug] = path.split('/');
  const query = new URLSearchParams({ kind, ...(slug ? { athlete: slug } : {}) });
  let requestBody = body;
  if (body) {
    const role = body.action === 'approve' ? body.actor === 'athlete' ? 'athlete' : 'instructor'
      : ['draft','discard','reset'].includes(body.action) ? 'shared_editor'
        : ['feedback','remember','forget','finish'].includes(body.action) ? 'athlete' : 'conversation';
    if (!proof?.actors?.[role]) throw Error('Reopen through Leadership to continue.');
    requestBody = {...body, revision:proof.revision, actor_capability:proof.actors[role], state_hash:proof.state_hash, proof_revision:proof.revision};
  }
  const response = await fetch(`${endpoint}?${query}`, {credentials:'same-origin',cache:'no-store',...(body ? {
    method:'POST',headers:{'Content-Type':'application/json','x-athlete-consulting-csrf':proof.csrf},body:JSON.stringify(requestBody),
  } : {})});
  const value = await response.json();
  if (!response.ok) throw Error(response.status === 401 ? 'Please enter through the shared Leadership gate.' : value.error || 'Please try again.');
  return value;
}
