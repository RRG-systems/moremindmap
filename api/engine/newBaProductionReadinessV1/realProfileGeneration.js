import {
  WBM_DOMAINS,
  assembleWholeBusinessContext,
  buildWholeBusinessModel,
  buildWholeBusinessSynthesisMission,
  createFrontierSynthesisAdapter,
  loadFrozenAuthorityLibrary,
} from '../../../src/lib/wholeBusinessModelV1/index.js';
import { buildFiveFuturesV2, createTrajectoryGenerationAdapter } from '../../../src/lib/fiveFuturesV2/index.js';
import { buildOneMoveV2, createCandidateGenerationAdapter } from '../../../src/lib/oneMoveV2/index.js';
import {
  applyOneMoveFieldMissionOwnership,
  applyWbmFieldMissionOwnership,
  assembleWbmCandidate,
  buildFiveFuturesSemanticSchema,
  buildOneMoveCandidateSchema,
  buildWbmSemanticSchema,
  createBoundedOpenAITripletProvider,
  createStreamingOpenAITransport,
  normalizeOneMoveCandidateContract,
  validateStrictSchemaShape,
} from '../../runtime/_patriciaCanonicalBaTripletV1.mjs';
import {
  deriveProviderIdentityTokens,
  inspectProviderPrivacy,
  sanitizeProviderBoundValue,
} from '../newBosProductionReadinessV1/privacyEgress.js';
import {
  buildNewBosBackgroundExecutionRequest,
  executeNewBosBackgroundResponse,
  inspectNewBosBackgroundTransportDiff,
  resumeNewBosBackgroundResponse,
} from '../newBosProductionReadinessV1/backgroundResponsesTransport.js';
import OpenAI from 'openai';

import { validateBaProviderEgressPayload } from './privacyEgress.js';
import { normalizeProfileId, sha256Stable } from './stable.js';
import { classifyBaEvidenceSufficiency } from './evidenceSufficiency.js';
import { PRODUCTION_BA_CASSETTE_REGISTRY } from '../../../src/lib/baVerticalCassettesV1/index.js';
import { resolveAssessmentVerticalBinding } from '../../business-assessment/verticalBinding.js';

const WHOLE_PERSON_DOMAINS = Object.freeze({
  operating_core: ['operations', 'capacity', 'goals', 'stage'],
  work_relationships: ['relationship', 'team', 'operations', 'capacity'],
  pressure_recovery: ['accountability', 'operations', 'capacity', 'team'],
  role_seat: ['team', 'capacity', 'operations', 'stage'],
  cognition: ['operations', 'accountability', 'capacity', 'constraints'],
  energy: ['capacity', 'team', 'operations', 'goals'],
});

function invariant(condition, code, details = undefined) {
  if (condition) return;
  const error = new Error(code);
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function providerIdentityTokens({ source, displayName }) {
  return deriveProviderIdentityTokens({
    profile_id: source.profile_id,
    customer_id: source.assessment_id,
    subject_token: `REAL-BA-${source.profile_id}`,
    identity_context: { display_name: displayName },
  });
}

function providerSafeMission(mission, identityTokens) {
  const safe = sanitizeProviderBoundValue(mission, identityTokens);
  const privacy = inspectProviderPrivacy(safe, identityTokens);
  invariant(privacy.valid, 'new_ba_real_profile_provider_identity_privacy_failed', privacy.failures);
  validateBaProviderEgressPayload({ store: false, mission: safe });
  return safe;
}

function wholePersonClaims(source) {
  const claims = source.bos_authority?.fusion_authority?.claims || [];
  invariant(claims.length >= 1 && claims.length <= 6, 'new_ba_real_profile_whole_person_claim_count_invalid');
  invariant(claims.every((claim) => claim.business_cause_authority === false), 'new_ba_real_profile_whole_person_business_cause_prohibited');
  return claims.map((claim, index) => deepFreeze({
    claim_id: `WPC-${String(index + 1).padStart(2, '0')}`,
    meaning: claim.meaning,
    relevant_domains: WHOLE_PERSON_DOMAINS[claim.category] || ['operations', 'capacity'],
    epistemic_class: claim.confidence || 'SUPPORTED_HYPOTHESIS',
    evidence_refs: unique(claim.evidence_refs || []),
    allowed_uses: claim.allowed_uses,
    source_claim_ref: claim.claim_ref,
    business_cause_authority: false,
  }));
}

export function buildGovernedRealProfileWbmInput({ source, requestedAt, cassetteRegistry = PRODUCTION_BA_CASSETTE_REGISTRY }) {
  const profileId = normalizeProfileId(source.profile_id);
  invariant(source.business_evidence?.profile_id === profileId, 'new_ba_real_profile_business_evidence_profile_mismatch');
  invariant(source.bos_authority?.profile_id === profileId, 'new_ba_real_profile_bos_profile_mismatch');
  const verticalBinding = resolveAssessmentVerticalBinding(source.business_evidence, { registry: cassetteRegistry });
  const cassette = cassetteRegistry.resolveVertical(verticalBinding.vertical_id);
  const questionAuthority = cassette.evidence_contract.question_authority;
  const evidenceSufficiency = source.business_evidence?.evidence_sufficiency || classifyBaEvidenceSufficiency({
    answers: source.business_evidence?.answers,
    answerSha256: source.business_evidence?.answer_sha256,
    questionAuthority: questionAuthority,
    questionKeys: cassette.intake_contract.questions.map((question) => question.key),
    requiredMissions: cassette.evidence_contract.sufficiency_missions,
  });
  const evidence = Object.entries(source.business_evidence.answers).map(([key, value], index) => deepFreeze({
    evidence_id: `BE-${String(index + 1).padStart(2, '0')}`,
    business_id: `business-${source.assessment_id}`,
    profile_id: profileId.toLowerCase(),
    domain: questionAuthority[key].primary_domain,
    evidence_class: 'OPERATOR_REPORTED',
    source_ref: `stored_business_assessment:inputs.answers.${key}`,
    observed_at: source.business_evidence.updated_at || source.business_evidence.created_at,
    value,
    units: null,
    period: 'assessment-time-self-report',
  }));
  invariant(evidenceSufficiency.status === 'PASS', 'new_ba_real_profile_business_evidence_sufficiency_required');
  const missingEvidence = [
    ['ME-01', 'operations', 'Which current direct operating records corroborate the customer-reported systems and execution state?', 'Could strengthen, weaken, or replace cross-domain operating mechanisms.'],
    ['ME-02', 'market', 'Which time-bound current market facts materially alter the internal business explanation?', 'Could identify or rule out an external constraint or confound.'],
    ['ME-03', 'stage', 'Which comparable observations across time establish current direction of travel?', 'Could change momentum, emerging-change support, and trajectory interpretation.'],
    ['ME-04', 'team', 'Which active team identities carry explicit WBM context authority and frozen BOS hashes?', 'Until proven, team structure remains operator-reported business evidence and no person-level team synthesis is authorized.'],
    ['ME-05', 'financial', 'Which governed financial records corroborate the operator-reported financial state and time window?', 'Could strengthen or revise economic and capacity conclusions.'],
  ].map(([missing_id, domain, question, decision_impact]) => deepFreeze({ missing_id, domain, question, decision_impact }));
  for (const consequence of evidenceSufficiency.localized_consequences) {
    missingEvidence.push(deepFreeze({
      missing_id: `ME-${consequence.question_key.toUpperCase()}`,
      domain: consequence.primary_domain,
      question: consequence.customer_safe_missing_evidence,
      decision_impact: `Keep ${consequence.primary_domain} claims and affected customer surfaces explicitly bounded until governed evidence is supplied.`,
    }));
  }
  const materialDomains = unique(Object.values(questionAuthority).flatMap((item) => [item.primary_domain, ...item.secondary_domains])).filter((domain) => WBM_DOMAINS.includes(domain));
  const claims = wholePersonClaims(source);
  return deepFreeze({
    requested_at: requestedAt,
    assessment_identity: {
      business_id: `business-${source.assessment_id}`,
      assessment_id: source.assessment_id,
      assessment_version: source.business_evidence.version,
      owner_profile_id: profileId.toLowerCase(),
      vertical: cassette.vertical_id,
      vertical_binding: verticalBinding,
      business_model_identity: source.business_evidence.assessment_type,
      completion_state: 'COMPLETE',
      evidence_sufficiency_state: evidenceSufficiency.preserve_missingness ? 'EVIDENCE_SUFFICIENT_WITH_MISSINGNESS' : 'EVIDENCE_SUFFICIENT_COMPLETE',
      evidence_sufficiency_contract_sha256: evidenceSufficiency.contract_sha256,
      assessed_at: source.business_evidence.created_at,
    },
    frozen_whole_person_authority: {
      profile_id: profileId.toLowerCase(),
      bos_version: source.bos_authority.version,
      bos_hash: source.bos_authority.sha256,
      claims,
    },
    governed_business_evidence: evidence,
    contradictions: [],
    missing_evidence: missingEvidence,
    dynamic_intelligence: [],
    team_authority: null,
    authorization: { permitted_profile_ids: [profileId.toLowerCase()] },
    context_hints: { material_domains: materialDomains },
  });
}

function wbmSchemaFromMission(mission) {
  const context = mission.context_packet;
  const evidenceBearingDomains = unique([
    ...context.business_evidence.map((item) => item.domain),
    ...context.missing_evidence.map((item) => item.domain),
  ]);
  const schema = buildWbmSemanticSchema({
    authorityIds: context.selection_receipt.selected_authority_ids,
    evidenceIds: context.business_evidence.map((item) => item.evidence_id),
    missingEvidenceIds: context.missing_evidence.map((item) => item.missing_id),
    wholePersonClaimIds: context.frozen_whole_person_authority.selected_claims.map((item) => item.claim_id),
    wholePersonEvidenceIds: unique(context.frozen_whole_person_authority.selected_claims.flatMap((item) => item.evidence_refs || [])),
    domainIds: evidenceBearingDomains,
  });
  validateStrictSchemaShape(schema);
  return schema;
}

function preflightRequestShape({ stage, mission, schema, schemaName, maxOutputTokens, identityTokens }) {
  const safeMission = providerSafeMission(mission, identityTokens);
  const shape = {
    model: 'gpt-5.6-sol', store: false, reasoning: { effort: 'xhigh' }, max_output_tokens: maxOutputTokens,
    input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(safeMission) }] }],
    text: { verbosity: 'low', format: { type: 'json_schema', name: schemaName, strict: true, schema } },
  };
  validateBaProviderEgressPayload(shape);
  const privacy = inspectProviderPrivacy(shape, identityTokens);
  invariant(privacy.valid, `new_ba_real_profile_${stage}_preflight_privacy_failed`, privacy.failures);
  return deepFreeze({ status: 'PASS', stage, model: shape.model, store: false, reasoning_effort: 'xhigh', strict_schema: true, request_shape_sha256: sha256Stable(shape), provider_safe_mission_sha256: sha256Stable(safeMission), prohibited_identity_findings: 0 });
}

export function createRealProfileGenerationContext({ source, displayName, requestedAt = source?.business_evidence?.updated_at || source?.business_evidence?.created_at, library = loadFrozenAuthorityLibrary(), cassetteRegistry = PRODUCTION_BA_CASSETTE_REGISTRY }) {
  const input = buildGovernedRealProfileWbmInput({ source, requestedAt, cassetteRegistry });
  const context = assembleWholeBusinessContext(input, { library, cassetteRegistry });
  const mission = applyWbmFieldMissionOwnership(buildWholeBusinessSynthesisMission(context));
  const schema = wbmSchemaFromMission(mission);
  const identityTokens = providerIdentityTokens({ source, displayName });
  const providerPreflight = preflightRequestShape({ stage: 'whole_business_model_v1', mission, schema, schemaName: 'real_profile_whole_business_model_v1', maxOutputTokens: 60_000, identityTokens });
  return deepFreeze({ input, context, mission, schema, identityTokens, library, cassetteRegistry, providerPreflight });
}

function makeProvider({ apiKey, identityTokens, startingStage = 'whole_business_model_v1', backgroundResponseStore = null, generationIdentitySha256 = null, profileId = null }) {
  invariant(typeof apiKey === 'string' && apiKey.length > 20, 'new_ba_real_profile_openai_binding_missing');
  const streaming = backgroundResponseStore ? null : createStreamingOpenAITransport({ apiKey });
  const backgroundClient = backgroundResponseStore ? new OpenAI({ apiKey, maxRetries: 0, timeout: 700_000 }) : null;
  const transport = async (request) => {
    validateBaProviderEgressPayload(request);
    const privacy = inspectProviderPrivacy(request, identityTokens);
    invariant(privacy.valid, 'new_ba_real_profile_provider_request_privacy_failed', privacy.failures);
    if (!backgroundResponseStore) return streaming.transport(request);
    const checkpoint = await backgroundResponseStore.load({ profileId, generationIdentitySha256, stage: startingStage });
    let legacyCompletedReplay = false;
    if (checkpoint) {
      const inspection = inspectNewBosBackgroundTransportDiff({ scientificRequest: request, executionRequest: buildNewBosBackgroundExecutionRequest(request) });
      invariant(inspection.valid, 'new_ba_background_resume_request_invalid');
      if (inspection.scientific_request_sha256 !== checkpoint.scientific_request_sha256) {
        invariant(checkpoint.provider_status === 'completed', 'new_ba_background_resume_request_hash_mismatch');
        legacyCompletedReplay = true;
      }
    }
    const onEvent = legacyCompletedReplay
      ? async () => null
      : (event) => backgroundResponseStore.save({ profileId, generationIdentitySha256, stage: startingStage, event });
    try {
      const result = checkpoint
        ? await resumeNewBosBackgroundResponse({ client: backgroundClient, responseId: checkpoint.provider_response_id, scientificRequest: request, maxWaitMs: 600_000, onEvent })
        : await executeNewBosBackgroundResponse({ client: backgroundClient, scientificRequest: request, maxWaitMs: 600_000, onEvent });
      return result.response;
    } catch (error) {
      if (['background_poll_timeout', 'background_resume_poll_timeout'].includes(error?.code)) {
        error.code = 'new_ba_provider_background_in_progress';
        error.background_pending = true;
      }
      throw error;
    }
  };
  const provider = createBoundedOpenAITripletProvider({ transport, maxRetriesPerStage: 1, startingStage });
  return { provider, streaming: streaming || { traces: () => Object.freeze([]) } };
}

async function callWithRetry(provider, args) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await provider.call(args);
    } catch (error) {
      lastError = error;
      if (error?.background_pending) throw error;
      if (attempt === 2) throw error;
    }
  }
  throw lastError;
}

export async function generateRealProfileWbm({ source, displayName, apiKey, requestedAt = source?.business_evidence?.updated_at || source?.business_evidence?.created_at, library = loadFrozenAuthorityLibrary(), cassetteRegistry = PRODUCTION_BA_CASSETTE_REGISTRY, backgroundResponseStore = null, generationIdentitySha256 = null }) {
  const generation = createRealProfileGenerationContext({ source, displayName, requestedAt, library, cassetteRegistry });
  const { provider, streaming } = makeProvider({ apiKey, identityTokens: generation.identityTokens, backgroundResponseStore, generationIdentitySha256, profileId: source.profile_id });
  const synthesisAdapter = createFrontierSynthesisAdapter({
    synthesize: async ({ mission }) => {
      const governedMission = applyWbmFieldMissionOwnership(mission);
      const schema = wbmSchemaFromMission(governedMission);
      const result = await callWithRetry(provider, {
        stage: 'whole_business_model_v1',
        mission: providerSafeMission(governedMission, generation.identityTokens),
        schema,
        schemaName: 'real_profile_whole_business_model_v1',
        maxOutputTokens: 60_000,
      });
      return assembleWbmCandidate(result.parsed, governedMission.context_packet);
    },
  });
  const result = await buildWholeBusinessModel(generation.input, { synthesisAdapter, library, cassetteRegistry });
  return deepFreeze({
    result,
    preflight: generation.providerPreflight,
    provider: { accepted_calls: provider.acceptedCallCount(), submissions: provider.callCount(), receipts: provider.receipts(), attempts: provider.attemptReceipts(), transport: streaming.traces() },
  });
}

export async function generateRealProfileFutures({ source, displayName, apiKey, wbm, backgroundResponseStore = null, generationIdentitySha256 = null }) {
  const identityTokens = providerIdentityTokens({ source, displayName });
  const { provider, streaming } = makeProvider({ apiKey, identityTokens, startingStage: 'five_futures_v2', backgroundResponseStore, generationIdentitySha256, profileId: source.profile_id });
  const schema = buildFiveFuturesSemanticSchema({ mechanismIds: wbm.causal_model.mechanisms.map((item) => item.mechanism_id), evidenceIds: wbm.source_integrity.evidence_refs });
  validateStrictSchemaShape(schema);
  const trajectoryAdapter = createTrajectoryGenerationAdapter({ generate: async ({ mission }) => {
    preflightRequestShape({ stage: 'five_futures_v2', mission, schema, schemaName: 'real_profile_five_futures_v2', maxOutputTokens: 30_000, identityTokens });
    const result = await callWithRetry(provider, { stage: 'five_futures_v2', mission: providerSafeMission(mission, identityTokens), schema, schemaName: 'real_profile_five_futures_v2', maxOutputTokens: 30_000 });
    return result.parsed.futures;
  } });
  const result = await buildFiveFuturesV2(wbm, { trajectoryAdapter });
  return deepFreeze({ result, provider: { accepted_calls: provider.acceptedCallCount(), submissions: provider.callCount(), receipts: provider.receipts(), attempts: provider.attemptReceipts(), transport: streaming.traces() } });
}

export async function generateRealProfileOneMove({ source, displayName, apiKey, wbm, futures, library = loadFrozenAuthorityLibrary(), backgroundResponseStore = null, generationIdentitySha256 = null }) {
  const identityTokens = providerIdentityTokens({ source, displayName });
  const { provider, streaming } = makeProvider({ apiKey, identityTokens, startingStage: 'one_move_v2', backgroundResponseStore, generationIdentitySha256, profileId: source.profile_id });
  const candidateAdapter = createCandidateGenerationAdapter({ generate: async ({ mission }) => {
    const governedMission = applyOneMoveFieldMissionOwnership(mission);
    const schema = buildOneMoveCandidateSchema({
      mechanismIds: governedMission.context.causal_mechanisms.map((item) => item.mechanism_id),
      evidenceIds: governedMission.context.evidence_refs,
      personRelationshipIds: governedMission.context.whole_person_execution_context.map((item) => item.relationship_id),
      scriptIds: governedMission.context.selected_script_intelligence.map((item) => item.script_id),
    });
    validateStrictSchemaShape(schema);
    preflightRequestShape({ stage: 'one_move_v2', mission: governedMission, schema, schemaName: 'real_profile_one_move_v2_candidates', maxOutputTokens: 30_000, identityTokens });
    const result = await callWithRetry(provider, { stage: 'one_move_v2', mission: providerSafeMission(governedMission, identityTokens), schema, schemaName: 'real_profile_one_move_v2_candidates', maxOutputTokens: 30_000 });
    return normalizeOneMoveCandidateContract(result.parsed.candidates);
  } });
  const result = await buildOneMoveV2(wbm, futures, { candidateAdapter, library });
  return deepFreeze({ result, provider: { accepted_calls: provider.acceptedCallCount(), submissions: provider.callCount(), receipts: provider.receipts(), attempts: provider.attemptReceipts(), transport: streaming.traces() } });
}

export function buildSanitizedStageReceipt({ profileId, stage, artifact, provider }) {
  return deepFreeze({
    profile_id: normalizeProfileId(profileId),
    stage,
    artifact_sha256: stage === 'whole_business_model_v1' ? artifact.state_hash : artifact.artifact_hash,
    accepted_calls: provider.accepted_calls,
    submissions: provider.submissions,
    model: 'gpt-5.6-sol',
    store: false,
    receipts: provider.receipts,
    attempts: provider.attempts,
    transport: provider.transport,
    raw_request_persisted: false,
    raw_response_persisted: false,
  });
}
