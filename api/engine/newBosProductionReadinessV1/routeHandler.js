import { classifyRecoveryFailure, REALIZATION_RECOVERY_STATES } from '../realizationRecoveryV1/recoveryContract.js';

const GOVERNED_CUSTOMER_CODES = new Set([
  'new_bos_canonical_profile_not_found',
  'new_bos_modernization_requires_evidence_or_review',
]);

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
  if (classifyRecoveryFailure(error) === REALIZATION_RECOVERY_STATES.TRANSIENT_INFRASTRUCTURE) return 503;
  return 500;
}

function customerSafeCode(error) {
  const code = String(error?.message || 'new_bos_unknown_failure').split(':')[0];
  return GOVERNED_CUSTOMER_CODES.has(code) ? code : 'new_bos_temporarily_unavailable';
}

function customerSafePending(result) {
  const messages = Object.freeze({
    UNDERSTANDING_PROFILE: 'We’re carefully building your whole-person understanding from your completed assessment.',
    BUILDING_WHOLE_PERSON_MAP: 'We’re connecting the parts of your assessment into one governed whole-person model.',
    CRAFTING_YOUR_EXPERIENCE: 'Your understanding is complete enough for us to craft the full experience. Nothing partial will be shown.',
    FINALIZING: 'We’re completing final integrity checks before making your experience available.',
  });
  const phase = Object.hasOwn(messages, result?.phase) ? result.phase : 'UNDERSTANDING_PROFILE';
  return Object.freeze({
    pending: true,
    status: 'REALIZATION_RECOVERY_IN_PROGRESS',
    phase,
    message: messages[phase],
    resumable: true,
    retry_after_ms: Math.min(Math.max(Number(result?.retry_after_ms) || 2000, 2000), 5000),
  });
}

function customerSafeReviewRequired() {
  return Object.freeze({
    pending: false,
    status: 'REALIZATION_REVIEW_REQUIRED',
    message: 'We preserved your completed assessment and the work already finished. We couldn’t safely complete the remaining processing automatically.',
    resumable: false,
    support_available: true,
  });
}

function platformProtectedCandidateRequest(request, config) {
  const deploymentHost = String(config?.deploymentHost || '').trim().toLowerCase();
  const requestHost = String(request.headers?.host || '').trim().toLowerCase();
  return deploymentHost.endsWith('.vercel.app') && requestHost === deploymentHost;
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
      const operation = request.query?.diagnostic === 'resumable-state'
        ? 'inspectResumable'
        : request.query?.diagnostic === 'state'
          ? 'diagnose'
          : 'retrieve';
      if (typeof service?.[operation] !== 'function') throw new Error('new_bos_route_service_operation_unavailable');
      const result = await service[operation]({
        profileId: request.query?.id,
        suppliedToken: tokenFromRequest(request),
        platformProtected: operation === 'inspectResumable' && platformProtectedCandidateRequest(request, config),
      });
      if (result?.pending) return response.status(202).json(customerSafePending(result));
      if (result?.review_required) return response.status(409).json(customerSafeReviewRequired());
      return response.status(200).json(result);
    } catch (error) {
      return response.status(safeStatus(error)).json({
        error: 'New BOS realization unavailable',
        safe_code: customerSafeCode(error),
      });
    }
  };
}
