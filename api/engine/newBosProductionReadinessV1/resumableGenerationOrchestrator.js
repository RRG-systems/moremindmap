import { inspectNewBosBackgroundTransportDiff, buildNewBosBackgroundExecutionRequest, executeNewBosBackgroundResponse, resumeNewBosBackgroundResponse } from './backgroundResponsesTransport.js';
import {
  buildNewBosSemanticStageRequest,
  createNewBosSemanticStageProvider,
  NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
  semanticStageRequestContractVersion,
} from './reasoningProvider.js';
import { sha256Stable } from './realizationIdentity.js';
import {
  assembleNewBosReasoningDraftV1,
  buildNewBosResumableCampaignIdentity,
  buildNewBosSemanticStageSchema,
  NEW_BOS_SEMANTIC_STAGES,
  validateNewBosSemanticStageFragment,
} from './resumableSemanticContract.js';
import { classifySemanticValidationError } from './completedStage3ValidationDiagnostic.js';

function terminalObservation(error) {
  const response = error?.providerResponse;
  return Object.freeze({
    provider_response_id: response?.id || error?.responseId || null,
    provider_request_id: response?._request_id || null,
    status: response?.status || error?.status || 'failed',
    incomplete_details_reason: response?.incomplete_details?.reason || null,
    error_code: response?.error?.code || (error?.responseId ? null : 'transport_error'),
    model: response?.model || null,
    service_tier: response?.service_tier || null,
    created_at: response?.created_at || null,
    completed_at: response?.completed_at || null,
    usage: response?.usage || null,
    observed_at: new Date().toISOString(),
  });
}

function humanReviewError(stageId, classification) {
  return Object.assign(new Error(`new_bos_resumable_stage_${classification?.state || 'unavailable'}:${stageId}`), {
    human_review_required: true,
    recovery_phase: stageId === 'causal_foundation' || stageId === 'operating_domains'
      ? 'UNDERSTANDING_PROFILE'
      : 'BUILDING_WHOLE_PERSON_MAP',
    recovery_classification: classification || null,
  });
}

export async function runNewBosResumableSemanticGeneration({
  rawEvidence,
  governedContext,
  realizationIdentity,
  model,
  client,
  checkpointStore,
  privacyTokens = [],
  interactiveWaitMs = 12_000,
  maxNewSemanticUnits = Number.POSITIVE_INFINITY,
  onTechnicalEvent = async () => {},
  onUsage = async () => {},
} = {}) {
  if (!(maxNewSemanticUnits === Number.POSITIVE_INFINITY
      || (Number.isSafeInteger(maxNewSemanticUnits) && maxNewSemanticUnits >= 1))) {
    throw new Error('new_bos_resumable_semantic_unit_limit_invalid');
  }
  const evidenceIds = rawEvidence.evidence.map(({ evidence_id: evidenceId }) => evidenceId);
  const campaignIdentity = buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds });
  const accepted = [];
  const acceptedUsage = [];
  let acceptedSubmissionCount = 0;
  let submissionCount = 0;
  let retrievalCount = 0;
  let newlyAcceptedUnits = 0;

  for (const stage of NEW_BOS_SEMANTIC_STAGES) {
    const acceptedDependencies = accepted
      .filter((item) => stage.dependencies.includes(item.stage_id))
      .map((item) => Object.freeze({
        stage_id: item.stage_id,
        fragment: item.fragment,
        fragment_sha256: item.fragment_sha256,
      }));
    if (acceptedDependencies.length !== stage.dependencies.length) {
      throw new Error(`new_bos_resumable_stage_dependency_missing:${stage.id}`);
    }
    const plan = buildNewBosSemanticUnitPlan({
      rawEvidence,
      governedContext,
      realizationIdentity,
      model,
      stageId: stage.id,
      acceptedDependencies,
      privacyTokens,
    });
    const {
      request_sha256: requestSha256,
      unit_identity_sha256: unitIdentitySha256,
      unit_id: unitId,
    } = plan;
    let prepared;
    if (stage.id === 'whole_person_decision_synthesis') {
      const existing = await checkpointStore.inspect({
        campaignSha256: campaignIdentity.sha256,
        unitId,
      });
      if (existing?.record?.state === 'ACCEPTED'
        && existing.record.unit_identity_sha256 !== unitIdentitySha256) {
        const legacyPlan = buildNewBosSemanticUnitPlan({
          rawEvidence,
          governedContext,
          realizationIdentity,
          model,
          stageId: stage.id,
          acceptedDependencies,
          privacyTokens,
          requestContractVersion: NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1,
        });
        if (existing.record.unit_identity_sha256 !== legacyPlan.unit_identity_sha256
          || existing.record.request_sha256 !== legacyPlan.request_sha256) {
          throw new Error('new_bos_resumable_stage3_legacy_checkpoint_identity_mismatch');
        }
        prepared = Object.freeze({
          disposition: 'REUSE_ACCEPTED',
          record: existing.record,
          classification: existing.classification,
        });
      }
    }
    prepared ||= await checkpointStore.prepare({
      campaignSha256: campaignIdentity.sha256,
      unitId,
      unitIdentitySha256,
      requestSha256,
    });
    if (prepared.disposition === 'REUSE_ACCEPTED') {
      const fragment = validateNewBosSemanticStageFragment({ stageId: stage.id, fragment: prepared.record.accepted_value });
      accepted.push(Object.freeze({ stage_id: stage.id, fragment, fragment_sha256: prepared.record.accepted_value_sha256 }));
      const acceptedAttempts = Number(prepared.record.attempt) || 1;
      acceptedSubmissionCount += acceptedAttempts;
      acceptedUsage.push(Object.freeze({
        stage_id: stage.id,
        usage: prepared.record.observation?.usage || null,
        provider_submissions: acceptedAttempts,
      }));
      await onTechnicalEvent(Object.freeze({ stage: 'semantic_checkpoint_reused', semantic_stage_id: stage.id }));
      continue;
    }
    if (!['START_INITIAL', 'START_REPLACEMENT', 'RESUME_EXACT'].includes(prepared.disposition)) {
      throw humanReviewError(stage.id, prepared.classification);
    }

    const provider = createNewBosSemanticStageProvider({
      model,
      stageId: stage.id,
      privacyTokens,
      requestContractVersion: plan.request_contract_version,
      transport: async (request) => {
        if (sha256Stable(request) !== requestSha256) throw new Error('new_bos_resumable_stage_request_drift');
        const inspection = inspectNewBosBackgroundTransportDiff({
          scientificRequest: request,
          executionRequest: buildNewBosBackgroundExecutionRequest(request),
        });
        if (!inspection.valid) throw new Error('new_bos_resumable_stage_background_contract_invalid');
        const onEvent = async (event) => {
          await checkpointStore.observe({
            campaignSha256: campaignIdentity.sha256,
            unitId,
            unitIdentitySha256,
            requestSha256,
            event,
          });
          await onTechnicalEvent(Object.freeze({
            stage: 'semantic_transport',
            semantic_stage_id: stage.id,
            status: event.status,
            incomplete_details_reason: event.incomplete_details_reason,
            error_code: event.error_code,
            usage: event.usage,
            poll_count: event.poll_count,
          }));
        };
        try {
          const result = prepared.disposition === 'RESUME_EXACT'
            ? await resumeNewBosBackgroundResponse({
              client,
              responseId: prepared.record.observation.provider_response_id,
              scientificRequest: request,
              maxWaitMs: interactiveWaitMs,
              onEvent,
            })
            : await executeNewBosBackgroundResponse({
              client,
              scientificRequest: request,
              maxWaitMs: interactiveWaitMs,
              onEvent,
            });
          submissionCount += result.transport_evidence.submit_count;
          retrievalCount += result.transport_evidence.poll_count
            + (result.transport_evidence.mode === 'background_resume_existing' ? 1 : 0);
          return result.response;
        } catch (error) {
          if (['background_poll_timeout', 'background_resume_poll_timeout'].includes(error?.code)) {
            error.code = 'new_bos_provider_background_in_progress';
            error.background_pending = true;
          } else if (!error?.providerResponse && !error?.responseId) {
            await checkpointStore.observe({
              campaignSha256: campaignIdentity.sha256,
              unitId,
              unitIdentitySha256,
              requestSha256,
              event: terminalObservation(error),
            });
          }
          throw error;
        }
      },
      capture: async ({ response, receipt }) => {
        await onUsage(response);
        await onTechnicalEvent(Object.freeze({
          stage: 'semantic_completed',
          semantic_stage_id: stage.id,
          provider_response_id_sha256: receipt.provider_response_id ? sha256Stable(receipt.provider_response_id) : null,
          requested_model: receipt.requested_model,
          returned_model: receipt.returned_model,
          latency_ms: receipt.latency_ms,
          usage: receipt.usage,
        }));
      },
    });

    try {
      const fragment = await provider.infer({
        raw_evidence: rawEvidence,
        governed_context: governedContext,
        accepted_dependencies: acceptedDependencies,
      });
      const record = await checkpointStore.accept({
        campaignSha256: campaignIdentity.sha256,
        unitId,
        unitIdentitySha256,
        requestSha256,
        value: fragment,
      });
      accepted.push(Object.freeze({ stage_id: stage.id, fragment, fragment_sha256: record.accepted_value_sha256 }));
      const acceptedAttempts = Number(record.attempt) || 1;
      acceptedSubmissionCount += acceptedAttempts;
      acceptedUsage.push(Object.freeze({
        stage_id: stage.id,
        usage: record.observation?.usage || null,
        provider_submissions: acceptedAttempts,
      }));
      newlyAcceptedUnits += 1;
      if (newlyAcceptedUnits >= maxNewSemanticUnits
          && accepted.length < NEW_BOS_SEMANTIC_STAGES.length) {
        throw Object.assign(new Error('new_bos_bounded_semantic_step_complete'), {
          code: 'new_bos_bounded_semantic_step_complete',
          background_pending: true,
          recovery_phase: accepted.length < 2
            ? 'UNDERSTANDING_PROFILE'
            : 'BUILDING_WHOLE_PERSON_MAP',
        });
      }
    } catch (error) {
      if (error?.background_pending || error?.human_review_required) throw error;
      const rejection = classifySemanticValidationError(error);
      if (rejection) {
        await checkpointStore.rejectSemantic({
          campaignSha256: campaignIdentity.sha256,
          unitId,
          unitIdentitySha256,
          requestSha256,
          rejection,
        });
      }
      throw error;
    }
  }

  const interpretationDraft = assembleNewBosReasoningDraftV1({ fragments: accepted });
  return Object.freeze({
    campaign_identity: campaignIdentity,
    interpretation_draft: interpretationDraft,
    interpretation_draft_sha256: sha256Stable(interpretationDraft),
    accepted_stages: Object.freeze(accepted.map(({ stage_id: stageId, fragment_sha256: fragmentSha256 }) => Object.freeze({
      stage_id: stageId,
      fragment_sha256: fragmentSha256,
    }))),
    accepted_stage_usage: Object.freeze(acceptedUsage),
    campaign_provider_submissions: acceptedSubmissionCount,
    provider_submissions: submissionCount,
    provider_retrievals: retrievalCount,
  });
}

export function buildNewBosSemanticUnitPlan({
  rawEvidence,
  governedContext,
  realizationIdentity,
  model,
  stageId,
  acceptedDependencies = [],
  privacyTokens = [],
  requestContractVersion = semanticStageRequestContractVersion(stageId),
} = {}) {
  const evidenceIds = rawEvidence.evidence.map(({ evidence_id: evidenceId }) => evidenceId);
  const campaignIdentity = buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds });
  const scientificRequest = buildNewBosSemanticStageRequest({
    rawEvidence,
    governedContext,
    model,
    stageId,
    acceptedDependencies,
    privacyTokens,
    requestContractVersion,
  });
  const requestSha256 = sha256Stable(scientificRequest);
  const unitIdentity = {
    version: requestContractVersion === NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1
      ? 'new_bos_resumable_semantic_unit_v1'
      : 'new_bos_resumable_semantic_unit_v2',
    campaign_sha256: campaignIdentity.sha256,
    stage_id: stageId,
    stage_schema_sha256: sha256Stable(buildNewBosSemanticStageSchema({ stageId, evidenceIds })),
    dependency_hashes: acceptedDependencies.map(({ stage_id: dependencyStageId, fragment_sha256: fragmentSha256 }) => [dependencyStageId, fragmentSha256]),
    scientific_request_sha256: requestSha256,
    ...(requestContractVersion === NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1
      ? {}
      : { request_contract_version: requestContractVersion }),
  };
  const unitIdentitySha256 = sha256Stable(unitIdentity);
  return Object.freeze({
    campaign_identity: campaignIdentity,
    scientific_request: scientificRequest,
    request_sha256: requestSha256,
    unit_identity_sha256: unitIdentitySha256,
    unit_id: `semantic:${stageId}`,
    request_contract_version: requestContractVersion,
  });
}
