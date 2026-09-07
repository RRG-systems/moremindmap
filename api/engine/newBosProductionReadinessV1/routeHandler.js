import { classifyRecoveryFailure, REALIZATION_RECOVERY_STATES } from '../realizationRecoveryV1/recoveryContract.js';
import { timingSafeHeaderMatch } from '../../../src/lib/publicSiteAirlockV1/security.js';

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
  if (/public_product_|profile_owner_required/u.test(error?.message || '')) return 404;
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

function customerSafeArtifact(result) {
  if (!result?.artifact || typeof result.artifact !== 'object' || Array.isArray(result.artifact)) {
    throw new Error('new_bos_customer_artifact_unavailable');
  }
  return Object.freeze({ artifact: result?.artifact });
}

function platformProtectedCandidateRequest(request, config) {
  return timingSafeHeaderMatch(
    request.headers?.['x-more-platform-authority'],
    config?.platformAuthoritySecret,
  );
}

export function createNewBosProductionRouteHandler({ config, serviceFactory, authorizeCustomerRead = null }) {
  if (typeof serviceFactory !== 'function') throw new Error('new_bos_route_service_factory_required');
  return async function newBosProductionRoute(request, response) {
    response.setHeader('cache-control', 'private, no-store, max-age=0');
    response.setHeader('x-content-type-options', 'nosniff');
    if (!config.staged || (!config.canaryEnabled && !config.customerActive)) {
      return response.status(404).json({ error: 'Not found' });
    }
    const staleSurfaceRoutingReplacement = request.method === 'POST'
      && request.query?.action === 'replace-stale-surface-routing';
    const invalidStage3Repair = request.method === 'POST'
      && request.query?.action === 'repair-invalid-stage3-vector-free';
    const completedStage3Classification = request.method === 'POST'
      && request.query?.action === 'classify-completed-stage3-semantic-rejection';
    const semanticRejectedStage3Replacement = request.method === 'POST'
      && request.query?.action === 'replace-semantic-rejected-stage3';
    const stage3RequestContractV2Replacement = request.method === 'POST'
      && request.query?.action === 'replace-stage3-request-contract-v2';
    if (!['GET', 'POST'].includes(request.method)
      || (request.method === 'POST'
        && !staleSurfaceRoutingReplacement
        && !invalidStage3Repair
        && !completedStage3Classification
        && !semanticRejectedStage3Replacement
        && !stage3RequestContractV2Replacement)) {
      return response.status(405).json({ error: 'Method not allowed' });
    }
    const operation = staleSurfaceRoutingReplacement
        ? 'replaceStaleSurfaceRouting'
        : invalidStage3Repair
          ? 'repairInvalidStage3VectorFree'
        : completedStage3Classification
          ? 'classifyCompletedStage3SemanticRejection'
        : semanticRejectedStage3Replacement
          ? 'replaceSemanticRejectedStage3'
        : stage3RequestContractV2Replacement
          ? 'replaceStage3RequestContractV2'
        : request.query?.diagnostic === 'completed-stage3-validation'
          ? 'inspectCompletedStage3Validation'
        : request.query?.diagnostic === 'semantic-assembly'
          ? 'inspectAcceptedSemanticAssembly'
        : request.query?.diagnostic === 'resumable-state'
        ? 'inspectResumable'
        : request.query?.diagnostic === 'state'
          ? 'diagnose'
          : 'retrieve';
    try {
      const operatorOperation = operation !== 'retrieve';
      const platformProtected = platformProtectedCandidateRequest(request, config);
      let customerAuthority = null;
      if (operatorOperation && !platformProtected) {
        throw new Error('new_bos_operator_inspection_access_denied');
      }
      if (operation === 'retrieve' && config.customerActive) {
        if (typeof authorizeCustomerRead !== 'function') throw new Error('new_bos_profile_owner_required');
        customerAuthority = await authorizeCustomerRead({ request, profileId: request.query?.id });
      }
      const created = await serviceFactory();
      const service = created?.service || created;
      if (typeof service?.[operation] !== 'function') throw new Error('new_bos_route_service_operation_unavailable');
      const result = await service[operation]({
        profileId: request.query?.id,
        suppliedToken: tokenFromRequest(request),
        platformProtected: operatorOperation && platformProtected,
        readOnly: customerAuthority?.mode === 'profile_owner_receipt',
        ...(operation === 'replaceStaleSurfaceRouting' ? {
          expectedCampaignSha256: request.body?.expected_campaign_sha256,
          expectedUnitIdentitySha256: request.body?.expected_unit_identity_sha256,
          expectedRequestSha256: request.body?.expected_request_sha256,
          expectedProviderResponseIdSha256: request.body?.expected_provider_response_id_sha256,
        } : {}),
        ...(operation === 'repairInvalidStage3VectorFree' ? {
          expectedCampaignSha256: request.body?.expected_campaign_sha256,
          expectedStage3: request.body?.expected_stage3,
          expectedStage4: request.body?.expected_stage4,
        } : {}),
        ...(operation === 'inspectCompletedStage3Validation' ? {
          expectedCampaignSha256: request.query?.expected_campaign_sha256,
          expectedUnitIdentitySha256: request.query?.expected_unit_identity_sha256,
          expectedRequestSha256: request.query?.expected_request_sha256,
          expectedProviderResponseIdSha256: request.query?.expected_provider_response_id_sha256,
        } : {}),
        ...(operation === 'classifyCompletedStage3SemanticRejection' ? {
          expectedCampaignSha256: request.body?.expected_campaign_sha256,
          expectedUnitIdentitySha256: request.body?.expected_unit_identity_sha256,
          expectedRequestSha256: request.body?.expected_request_sha256,
          expectedProviderResponseIdSha256: request.body?.expected_provider_response_id_sha256,
        } : {}),
        ...(operation === 'replaceSemanticRejectedStage3' ? {
          expectedCampaignSha256: request.body?.expected_campaign_sha256,
          expectedStage3: request.body?.expected_stage3,
        } : {}),
        ...(operation === 'replaceStage3RequestContractV2' ? {
          expectedCampaignSha256: request.body?.expected_campaign_sha256,
          expectedStage3: request.body?.expected_stage3,
        } : {}),
      });
      if (result?.pending) return response.status(202).json(customerSafePending(result));
      if (result?.review_required) return response.status(409).json(customerSafeReviewRequired());
      if (operation === 'retrieve' && config.customerActive) {
        return response.status(200).json(customerSafeArtifact(result));
      }
      return response.status(200).json(result);
    } catch (error) {
      return response.status(safeStatus(error)).json({
        error: 'New BOS realization unavailable',
        safe_code: customerSafeCode(error),
      });
    }
  };
}
