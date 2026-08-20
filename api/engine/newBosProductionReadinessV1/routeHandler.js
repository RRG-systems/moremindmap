function tokenFromRequest(request) {
  const explicit = request.headers?.['x-new-bos-canary-token'];
  if (typeof explicit === 'string') return explicit;
  const authorization = String(request.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function safeStatus(error) {
  if (/profile_id_invalid|profile_not_allowlisted/u.test(error?.message || '')) return 404;
  if (/access_denied/u.test(error?.message || '')) return 403;
  if (/requires_evidence_or_review/u.test(error?.message || '')) return 409;
  if (/provider_default_off/u.test(error?.message || '')) return 503;
  return 500;
}

export function createNewBosProductionRouteHandler({ config, serviceFactory }) {
  if (typeof serviceFactory !== 'function') throw new Error('new_bos_route_service_factory_required');
  return async function newBosProductionRoute(request, response) {
    response.setHeader('cache-control', 'private, no-store, max-age=0');
    response.setHeader('x-content-type-options', 'nosniff');
    if (!config.staged || (!config.canaryEnabled && !config.customerActive)) {
      return response.status(404).json({ error: 'Not found' });
    }
    if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
    try {
      const service = await serviceFactory();
      const operation = request.query?.diagnostic === 'state' ? 'diagnose' : 'retrieve';
      if (typeof service?.[operation] !== 'function') throw new Error('new_bos_route_service_operation_unavailable');
      const result = await service[operation]({
        profileId: request.query?.id,
        suppliedToken: tokenFromRequest(request),
      });
      return response.status(200).json(result);
    } catch (error) {
      return response.status(safeStatus(error)).json({
        error: 'New BOS realization unavailable',
        safe_code: String(error?.message || 'new_bos_unknown_failure').split(':')[0],
      });
    }
  };
}
