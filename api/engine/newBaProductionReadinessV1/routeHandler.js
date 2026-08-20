function tokenFromRequest(request) {
  const explicit = request.headers?.['x-new-ba-canary-token'];
  if (typeof explicit === 'string') return explicit;
  const authorization = String(request.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function safeStatus(error) {
  const message = String(error?.message || '');
  if (/profile_id_invalid|profile_not_allowlisted/u.test(message)) return 404;
  if (/access_denied/u.test(message)) return 403;
  if (/requires_evidence_or_review|hash_drift|identity_mismatch/u.test(message)) return 409;
  if (/default_off|not_authorized/u.test(message)) return 503;
  return 500;
}

export function createNewBaRouteHandler({ config, serviceFactory }) {
  if (typeof serviceFactory !== 'function') throw new Error('new_ba_route_service_factory_required');
  return async function newBaRoute(request, response) {
    response.setHeader('cache-control', 'private, no-store, max-age=0');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    if (!config.staged || (!config.canaryEnabled && !config.customerActive)) return response.status(404).json({ error: 'Not found' });
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
    let redis;
    try {
      const created = await serviceFactory();
      const service = created?.service || created;
      redis = created?.redis;
      const operation = request.query?.diagnostic === 'state' ? 'diagnose' : 'retrieve';
      const result = await service[operation]({ profileId: request.query?.id, suppliedToken: tokenFromRequest(request) });
      return response.status(result?.pending ? 202 : 200).json(result);
    } catch (error) {
      return response.status(safeStatus(error)).json({ error: 'New BA realization unavailable', safe_code: String(error?.message || 'new_ba_unknown_failure').split(':')[0] });
    } finally {
      if (redis) await redis.quit().catch(() => {});
    }
  };
}
