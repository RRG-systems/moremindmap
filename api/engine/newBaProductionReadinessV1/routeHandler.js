import { classifyRecoveryFailure, REALIZATION_RECOVERY_STATES } from '../realizationRecoveryV1/recoveryContract.js';

const GOVERNED_CUSTOMER_CODES = new Set([
  'new_ba_business_assessment_not_found',
  'new_ba_compatible_bos_authority_missing',
  'new_ba_modernization_requires_evidence_or_review',
]);

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
  if (classifyRecoveryFailure(error) === REALIZATION_RECOVERY_STATES.TRANSIENT_INFRASTRUCTURE) return 503;
  return 500;
}

function safeRuntimeDiagnostic(error) {
  const rawPath = typeof error?.path === 'string' ? error.path : '';
  const pathSuffix = rawPath
    ? rawPath.split(/[\\/]/u).filter(Boolean).slice(-6).join('/')
    : null;
  return Object.freeze({
    code: String(error?.code || String(error?.message || '').split(':')[0] || 'new_ba_unknown_failure'),
    path_suffix: pathSuffix,
  });
}

function customerSafeCode(error) {
  const code = String(error?.message || 'new_ba_unknown_failure').split(':')[0];
  return GOVERNED_CUSTOMER_CODES.has(code) ? code : 'new_ba_temporarily_unavailable';
}

function customerSafePending(result) {
  return Object.freeze({
    pending: true,
    status: 'GENERATION_ADVANCING',
    message: 'Your governed Business Twin is being prepared.',
    retry_after_ms: Math.min(Math.max(Number(result?.retry_after_ms) || 2000, 1000), 5000),
  });
}

export function createNewBaRouteHandler({ config, serviceFactory, onCanonicalServed = null }) {
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
      if (operation === 'retrieve' && !result?.pending && result?.artifact && typeof onCanonicalServed === 'function') {
        try {
          await onCanonicalServed({ redis, result, request });
        } catch (recruitingProjectionError) {
          console.error('[NEW-BA-ROUTE] Recruiting canonical projection deferred', {
            code: String(recruitingProjectionError?.message || 'RECRUITING_CANONICAL_PROJECTION_FAILED').split(':')[0],
            customer_payload_logged: false,
          });
        }
      }
      return response.status(result?.pending ? 202 : 200).json(result?.pending ? customerSafePending(result) : result);
    } catch (error) {
      console.error('[NEW-BA-ROUTE] Governed runtime unavailable', safeRuntimeDiagnostic(error));
      return response.status(safeStatus(error)).json({
        error: 'New BA realization unavailable',
        safe_code: customerSafeCode(error),
      });
    } finally {
      if (redis) await redis.quit().catch(() => {});
    }
  };
}
