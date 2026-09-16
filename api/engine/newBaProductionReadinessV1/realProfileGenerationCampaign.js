import { classifyNewBaCompatibility } from './compatibility.js';
import { NEW_BA_COMPLETENESS_STATUS, validateCompleteNewBaRealization } from './completeness.js';
import { buildLaunchSafeNewBaEnvelope } from './launchSafeRealizationStore.js';
import {
  buildSanitizedStageReceipt,
  createRealProfileGenerationContext,
  generateRealProfileFutures,
  generateRealProfileOneMove,
  generateRealProfileWbm,
} from './realProfileGeneration.js';
import { buildRealProfileNewBaRealization } from './realProfileRealizationFactory.js';
import { buildNewBaRealizationIdentityV3, sameNewBaRealizationIdentity } from './realizationIdentity.js';
import { normalizeProfileId, sha256Stable } from './stable.js';
import { assertScopedLoanOriginatorGenerationContext } from './scopedLoanOriginatorGeneration.js';

const REFERENCE_PROFILES = Object.freeze({
  'MM-20260617-YBNWT0KS': Object.freeze({ display_name: 'Amber', assessment_id: 'ba-20260722-881ba54d' }),
  'MM-20260531-ASOVNJZ4': Object.freeze({ display_name: 'Wally', assessment_id: 'ba-20260605-d2aa1165' }),
});

const STAGES = Object.freeze(['whole_business_model_v1', 'five_futures_v2', 'one_move_v2']);

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

function profileReference(profileId) {
  const profile = normalizeProfileId(profileId);
  return { profile, ...(REFERENCE_PROFILES[profile] || {}) };
}

function displayNameFor(source, reference) {
  const display = source?.identity_context?.display_name
    || source?.bos_authority?.identity_context?.display_name
    || reference?.display_name;
  invariant(typeof display === 'string' && display.trim(), 'new_ba_real_profile_campaign_display_name_missing');
  return display.trim();
}

function safeError(error) {
  const message = String(error?.message || '');
  const validationDetail = error?.name === 'WholeBusinessModelIntegrityError'
    ? message.replace(/^[A-Z_]+:\s*/u, '').replace(/[\r\n\t]+/gu, ' ').slice(0, 300)
    : null;
  return deepFreeze({
    error_code: String(error?.code || error?.message || error?.name || 'new_ba_real_profile_campaign_failure').split(':')[0],
    terminal_status: error?.provider_terminal?.status || null,
    incomplete_details_reason: error?.provider_terminal?.incomplete_details_reason || null,
    usage: error?.provider_terminal?.usage || null,
    max_output_tokens: error?.provider_terminal?.max_output_tokens || null,
    response_output_sha256: error?.provider_terminal?.response_output_sha256 || null,
    response_id_hash: error?.provider_terminal?.response_id_hash || null,
    validation_detail: validationDetail,
    raw_request_persisted: false,
    raw_response_persisted: false,
  });
}

function campaignRoot(namespace, profileId) {
  return `${namespace}:real-profile-generation-v1:${normalizeProfileId(profileId)}`;
}

function checkpointKey(namespace, profileId, generationIdentitySha256, stage) {
  invariant(/^[a-f0-9]{64}$/u.test(generationIdentitySha256 || ''), 'new_ba_real_profile_checkpoint_generation_identity_invalid');
  return `${namespace}:real-profile-generation-v2:${normalizeProfileId(profileId)}:${generationIdentitySha256}:checkpoint:${stage}`;
}

function failureKey(namespace, profileId) {
  return `${campaignRoot(namespace, profileId)}:failure-ledger`;
}

function generationIdentityFor(source, providerModel) {
  return realizationIdentityFor(source, classifyNewBaCompatibility(source), providerModel).sha256;
}

function realizationIdentityFor(source, compatibility, providerModel) {
  return buildNewBaRealizationIdentityV3({
    profileId: source.profile_id,
    assessmentId: source.assessment_id,
    evidenceSha256: source.business_evidence.evidence_sha256,
    bosAuthoritySha256: source.bos_authority.sha256,
    bosFusionContractSha256: source.bos_authority.fusion_contract_sha256,
    bosEvidenceBoundarySha256: source.bos_authority.evidence_boundary_sha256,
    compatibilityClass: compatibility.class,
    verticalBinding: source.business_evidence.vertical_binding,
    providerModel,
  });
}

function sourceIdentityReceipt(identity) {
  return Object.freeze({
    version: identity.version,
    realization_id: identity.realization_id,
    sha256: identity.sha256,
  });
}

function wrapCheckpoint({ profileId, assessmentId, generationIdentitySha256, stage, artifact, receipt }) {
  const body = {
    contract_id: 'new-ba-real-profile-generation-checkpoint-v1',
    profile_id: normalizeProfileId(profileId),
    assessment_id: assessmentId,
    generation_identity_sha256: generationIdentitySha256,
    stage,
    artifact,
    artifact_sha256: sha256Stable(artifact),
    provider_receipt: receipt,
    current_customer_pointer_advanced: false,
    raw_provider_payload_persisted: false,
  };
  return deepFreeze({ ...body, checkpoint_sha256: sha256Stable(body) });
}

function validateCheckpoint(checkpoint, { profileId, assessmentId, generationIdentitySha256, stage }) {
  invariant(checkpoint?.contract_id === 'new-ba-real-profile-generation-checkpoint-v1', 'new_ba_real_profile_checkpoint_contract_invalid');
  invariant(checkpoint.profile_id === normalizeProfileId(profileId) && checkpoint.assessment_id === assessmentId, 'new_ba_real_profile_checkpoint_identity_invalid');
  invariant(checkpoint.generation_identity_sha256 === generationIdentitySha256, 'new_ba_real_profile_checkpoint_generation_identity_invalid');
  invariant(checkpoint.stage === stage, 'new_ba_real_profile_checkpoint_stage_invalid');
  invariant(checkpoint.current_customer_pointer_advanced === false, 'new_ba_real_profile_checkpoint_publication_boundary_invalid');
  invariant(checkpoint.raw_provider_payload_persisted === false, 'new_ba_real_profile_checkpoint_raw_payload_prohibited');
  invariant(checkpoint.artifact_sha256 === sha256Stable(checkpoint.artifact), 'new_ba_real_profile_checkpoint_artifact_hash_invalid');
  const { checkpoint_sha256: checkpointSha256, ...body } = checkpoint;
  invariant(checkpointSha256 === sha256Stable(body), 'new_ba_real_profile_checkpoint_hash_invalid');
  return checkpoint;
}

async function readCheckpoint(redis, config, profile, generationIdentitySha256, stage) {
  const raw = await redis.get(checkpointKey(config.namespace, profile.profile, generationIdentitySha256, stage));
  return raw ? validateCheckpoint(JSON.parse(raw), { profileId: profile.profile, assessmentId: profile.assessment_id, generationIdentitySha256, stage }) : null;
}

async function persistCheckpoint(redis, config, checkpoint) {
  const key = checkpointKey(config.namespace, checkpoint.profile_id, checkpoint.generation_identity_sha256, checkpoint.stage);
  const serialized = JSON.stringify(checkpoint);
  const written = await redis.set(key, serialized, 'NX');
  if (written === 'OK') return { written: true, idempotent: false };
  const existing = validateCheckpoint(JSON.parse(await redis.get(key)), {
    profileId: checkpoint.profile_id,
    assessmentId: checkpoint.assessment_id,
    generationIdentitySha256: checkpoint.generation_identity_sha256,
    stage: checkpoint.stage,
  });
  invariant(existing.checkpoint_sha256 === checkpoint.checkpoint_sha256, 'new_ba_real_profile_checkpoint_immutable_conflict');
  return { written: false, idempotent: true };
}

async function appendFailure(redis, config, profileId, stage, error) {
  const receipt = {
    contract_id: 'new-ba-real-profile-generation-failure-receipt-v1',
    profile_id: normalizeProfileId(profileId),
    stage,
    failed_at: new Date().toISOString(),
    ...safeError(error),
  };
  receipt.receipt_sha256 = sha256Stable(receipt);
  await redis.rpush(failureKey(config.namespace, profileId), JSON.stringify(receipt));
  return receipt;
}

function checkpointSummary(checkpoint) {
  if (!checkpoint) return null;
  return deepFreeze({
    stage: checkpoint.stage,
    artifact_sha256: checkpoint.artifact_sha256,
    checkpoint_sha256: checkpoint.checkpoint_sha256,
    accepted_calls: checkpoint.provider_receipt.accepted_calls,
    submissions: checkpoint.provider_receipt.submissions,
    model: checkpoint.provider_receipt.model,
    store: false,
  });
}

function aggregateProviderAccounting(checkpoints) {
  const stageReceipts = checkpoints.map((checkpoint) => checkpoint.provider_receipt);
  const receipts = stageReceipts.flatMap((receipt) => receipt.receipts || []);
  const attempts = stageReceipts.flatMap((receipt) => receipt.attempts || []);
  const acceptedCalls = stageReceipts.reduce((sum, receipt) => sum + Number(receipt.accepted_calls || 0), 0);
  const submissions = stageReceipts.reduce((sum, receipt) => sum + Number(receipt.submissions || 0), 0);
  invariant(acceptedCalls === 3, 'new_ba_real_profile_three_accepted_provider_calls_required');
  return deepFreeze({
    model: 'gpt-5.6-sol',
    store: false,
    calls: acceptedCalls,
    accepted_calls: acceptedCalls,
    submissions,
    retries: Math.max(0, submissions - acceptedCalls),
    receipts,
    attempts,
    usage: receipts.reduce((total, receipt) => ({
      input_tokens: total.input_tokens + Number(receipt.usage?.input_tokens || 0),
      cached_input_tokens: total.cached_input_tokens + Number(receipt.usage?.cached_input_tokens || 0),
      output_tokens: total.output_tokens + Number(receipt.usage?.output_tokens || 0),
      reasoning_tokens: total.reasoning_tokens + Number(receipt.usage?.reasoning_tokens || 0),
      total_tokens: total.total_tokens + Number(receipt.usage?.total_tokens || 0),
    }), { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, total_tokens: 0 }),
    exact_cost_usd: null,
    cost_status: 'NOT_RETURNED_BY_PROVIDER_API',
    raw_request_persisted: false,
    raw_response_persisted: false,
  });
}

export function createRealProfileNewBaGenerationCampaign({ config, redis, authorityReader, realizationStore, backgroundResponseStore = null, apiKey, cassetteRegistry, library, projectionAdapters, oneMoveContextOptions = {}, generationContext = null }) {
  invariant(config?.staged && (config.customerActive || config.canaryEnabled) && config.providerEnabled && config.persistenceEnabled, 'new_ba_real_profile_campaign_runtime_not_enabled');
  invariant(config.providerModel === 'gpt-5.6-sol', 'new_ba_real_profile_campaign_model_invalid');
  invariant(typeof redis?.get === 'function' && typeof redis?.set === 'function' && typeof redis?.rpush === 'function' && typeof redis?.llen === 'function', 'new_ba_real_profile_campaign_redis_invalid');
  invariant(typeof authorityReader?.read === 'function', 'new_ba_real_profile_campaign_authority_reader_invalid');
  invariant(typeof realizationStore?.inspect === 'function', 'new_ba_real_profile_campaign_realization_store_invalid');
  invariant(typeof apiKey === 'string' && apiKey.length > 20, 'new_ba_real_profile_campaign_openai_binding_missing');

  async function sourceSnapshotFor(profile, expectedAuthority = null, expectedRealizationIdentity = null) {
    if (typeof expectedAuthority?.assertCurrent === 'function') await expectedAuthority.assertCurrent();
    const authorityRead = typeof authorityReader.readWithSourceGuards === 'function'
      ? await authorityReader.readWithSourceGuards(profile.profile, expectedAuthority || undefined)
      : { source: await authorityReader.read(profile.profile, expectedAuthority || undefined), sourceGuards: [] };
    const source = authorityRead.source;
    invariant(source.profile_id === profile.profile, 'new_ba_real_profile_campaign_source_identity_mismatch');
    if (source.business_evidence?.vertical_binding?.vertical_id === 'loan_originator') {
      assertScopedLoanOriginatorGenerationContext({ cassetteRegistry, library, oneMoveContextOptions, generationContext });
      invariant(generationContext?.sha256 && sha256Stable(source.business_evidence.generation_context) === sha256Stable(generationContext), 'new_ba_loan_originator_campaign_context_mismatch');
    }
    if (profile.assessment_id) invariant(source.assessment_id === profile.assessment_id, 'new_ba_real_profile_campaign_reference_assessment_mismatch');
    invariant(source.business_evidence.profile_id === profile.profile && source.bos_authority.profile_id === profile.profile, 'new_ba_real_profile_campaign_cross_profile_source');
    const compatibility = classifyNewBaCompatibility(source);
    invariant(compatibility.automatic_rebuild, 'new_ba_real_profile_campaign_business_evidence_insufficient', compatibility.evidence_sufficiency);
    invariant(source.bos_authority.fusion_authority.claims.every((claim) => claim.business_cause_authority === false), 'new_ba_real_profile_campaign_bos_business_cause_prohibited');
    const identity = realizationIdentityFor(source, compatibility, config.providerModel);
    if (expectedRealizationIdentity) {
      invariant(
        sameNewBaRealizationIdentity(identity, expectedRealizationIdentity),
        'new_ba_real_profile_campaign_expected_realization_identity_mismatch',
      );
    }
    return Object.freeze({ source, sourceGuards: authorityRead.sourceGuards || [], compatibility, identity });
  }

  async function sourceFor(profile, expectedAuthority = null, expectedRealizationIdentity = null) {
    return (await sourceSnapshotFor(profile, expectedAuthority, expectedRealizationIdentity)).source;
  }

  async function assertSourceAuthorityCurrent(profile, source, expectedAuthority, expectedRealizationIdentity = null) {
    const current = await sourceFor(profile, expectedAuthority, expectedRealizationIdentity);
    invariant(
      generationIdentityFor(current, config.providerModel) === generationIdentityFor(source, config.providerModel),
      'new_ba_manager_preparation_source_authority_mismatch',
    );
  }

  async function contextFor(profileId, expectedAuthority = null, expectedRealizationIdentity = null) {
    const reference = profileReference(profileId);
    const { source, sourceGuards, compatibility, identity } = await sourceSnapshotFor(reference, expectedAuthority, expectedRealizationIdentity);
    return {
      profile: {
        ...reference,
        assessment_id: source.assessment_id,
        display_name: displayNameFor(source, reference),
      },
      source,
      sourceGuards,
      compatibility,
      identity,
    };
  }

  async function status(profileId, expectedAuthority = null) {
    const { profile, source } = await contextFor(profileId, expectedAuthority);
    const generationIdentitySha256 = generationIdentityFor(source, config.providerModel);
    const checkpoints = await Promise.all(STAGES.map((stage) => readCheckpoint(redis, config, profile, generationIdentitySha256, stage)));
    const failureLedgerKey = failureKey(config.namespace, profile.profile);
    const failures = await redis.llen(failureLedgerKey);
    const latestFailure = failures > 0 && typeof redis.lindex === 'function'
      ? JSON.parse(await redis.lindex(failureLedgerKey, -1))
      : null;
    const compatibility = classifyNewBaCompatibility(source);
    const identity = realizationIdentityFor(source, compatibility, config.providerModel);
    const current = await realizationStore.inspect({ profileId: profile.profile, desiredIdentity: identity });
    return deepFreeze({
      status: 'ok', profile_id: profile.profile, assessment_id: profile.assessment_id,
      answer_hash_count: Object.keys(source.business_evidence.answer_sha256).length,
      unanswered_questions: source.business_evidence.evidence_sufficiency?.unanswered_questions || [],
      evidence_sufficiency_status: source.business_evidence.evidence_sufficiency?.status || compatibility.evidence_sufficiency?.status,
      bos_authority_sha256: source.bos_authority.sha256,
      bos_fusion_contract_sha256: source.bos_authority.fusion_contract_sha256,
      business_cause_authority: false,
      generation_identity_sha256: generationIdentitySha256,
      checkpoints: checkpoints.map(checkpointSummary),
      failure_receipt_count: failures,
      latest_failure: latestFailure,
      desired_realization_id: identity.realization_id,
      realization_state: current.state,
      current_realization_id: current.pointer,
      provider_model: config.providerModel,
      store: false,
    });
  }

  async function preflight(profileId, expectedAuthority = null) {
    const { profile, source } = await contextFor(profileId, expectedAuthority);
    const generation = createRealProfileGenerationContext({ source, displayName: profile.display_name, library, cassetteRegistry });
    return deepFreeze({
      status: 'PASS',
      profile_id: profile.profile,
      assessment_id: profile.assessment_id,
      answer_hash_count: Object.keys(source.business_evidence.answer_sha256).length,
      unanswered_questions: source.business_evidence.evidence_sufficiency?.unanswered_questions || [],
      evidence_sufficiency: source.business_evidence.evidence_sufficiency,
      answer_hashes_sha256: sha256Stable(source.business_evidence.answer_sha256),
      bos_authority_sha256: source.bos_authority.sha256,
      bos_fusion_contract_sha256: source.bos_authority.fusion_contract_sha256,
      bos_evidence_boundary_sha256: source.bos_authority.evidence_boundary_sha256,
      universal_authority_count: generation.library.universal_bibles.length,
      real_estate_authority_count: generation.library.real_estate_bibles.length,
      ...(source.business_evidence.vertical_binding.vertical_id === 'loan_originator' ? { loan_originator_authority_count: generation.library.vertical_bibles.length } : {}),
      provider_egress: generation.providerPreflight,
      direct_identity_in_provider_payload: false,
      raw_bos_scores_in_provider_payload: false,
      business_cause_authority: false,
      provider_calls: 0,
    });
  }

  async function relationshipDiagnostic(profileId, expectedAuthority = null) {
    const { profile, source } = await contextFor(profileId, expectedAuthority);
    const generationIdentitySha256 = generationIdentityFor(source, config.providerModel);
    const checkpoint = await readCheckpoint(redis, config, profile, generationIdentitySha256, 'whole_business_model_v1');
    invariant(checkpoint, 'new_ba_real_profile_campaign_wbm_checkpoint_required');
    const authorityClaims = source.bos_authority.fusion_authority.claims;
    return deepFreeze({
      status: 'PASS',
      profile_id: profile.profile,
      assessment_id: profile.assessment_id,
      whole_business_model_sha256: checkpoint.artifact_sha256,
      relationships: (checkpoint.artifact.person_business_synthesis || []).map((relationship) => ({
        relationship_id: relationship.relationship_id,
        whole_person_claim_ref: relationship.whole_person_claim_ref,
        relationship_type: relationship.relationship_type,
        business_evidence_ref_count: relationship.business_evidence_refs?.length || 0,
        business_cause_established_by_personality: relationship.business_cause_established_by_personality,
      })),
      authority_claims: authorityClaims.map((claim, index) => ({
        provider_claim_ref: `WPC-${String(index + 1).padStart(2, '0')}`,
        canonical_claim_ref: claim.claim_ref,
        category: claim.category,
        allowed_uses: claim.allowed_uses,
        business_cause_authority: claim.business_cause_authority,
      })),
      customer_prose_included: false,
      raw_evidence_included: false,
      provider_payload_included: false,
      provider_calls: 0,
    });
  }

  async function generateStage(profileId, stage, expectedAuthority = null, expectedRealizationIdentity = null) {
    const { profile, source } = await contextFor(profileId, expectedAuthority, expectedRealizationIdentity);
    invariant(STAGES.includes(stage), 'new_ba_real_profile_campaign_stage_invalid');
    const generationIdentitySha256 = generationIdentityFor(source, config.providerModel);
    const existing = await readCheckpoint(redis, config, profile, generationIdentitySha256, stage);
    if (existing) return deepFreeze({ status: 'PASS', path: 'current_checkpoint', profile_id: profile.profile, assessment_id: profile.assessment_id, checkpoint: checkpointSummary(existing), provider_calls: 0 });
    try {
      const assertCurrentAuthority = () => assertSourceAuthorityCurrent(profile, source, expectedAuthority, expectedRealizationIdentity);
      let generated;
      if (stage === 'whole_business_model_v1') {
        await assertCurrentAuthority();
        generated = await generateRealProfileWbm({ source, displayName: profile.display_name, apiKey, library, cassetteRegistry, backgroundResponseStore, generationIdentitySha256, assertCurrentAuthority });
      } else if (stage === 'five_futures_v2') {
        const wbm = await readCheckpoint(redis, config, profile, generationIdentitySha256, 'whole_business_model_v1');
        invariant(wbm, 'new_ba_real_profile_campaign_wbm_checkpoint_required');
        await assertCurrentAuthority();
        generated = await generateRealProfileFutures({ source, displayName: profile.display_name, apiKey, wbm: wbm.artifact, backgroundResponseStore, generationIdentitySha256, assertCurrentAuthority });
      } else {
        const [wbm, futures] = await Promise.all([
          readCheckpoint(redis, config, profile, generationIdentitySha256, 'whole_business_model_v1'),
          readCheckpoint(redis, config, profile, generationIdentitySha256, 'five_futures_v2'),
        ]);
        invariant(wbm && futures, 'new_ba_real_profile_campaign_upstream_checkpoints_required');
        await assertCurrentAuthority();
        generated = await generateRealProfileOneMove({ source, displayName: profile.display_name, apiKey, library, oneMoveContextOptions, wbm: wbm.artifact, futures: futures.artifact, backgroundResponseStore, generationIdentitySha256, assertCurrentAuthority });
      }
      const artifact = stage === 'whole_business_model_v1' ? generated.result.model : stage === 'five_futures_v2' ? generated.result.artifact : generated.result.one_move;
      const receipt = buildSanitizedStageReceipt({ profileId: profile.profile, stage, artifact, provider: generated.provider });
      invariant(receipt.accepted_calls === 1, 'new_ba_real_profile_campaign_one_accepted_call_per_stage_required');
      const checkpoint = wrapCheckpoint({ profileId: profile.profile, assessmentId: profile.assessment_id, generationIdentitySha256, stage, artifact, receipt });
      await assertCurrentAuthority();
      const persistence = await persistCheckpoint(redis, config, checkpoint);
      return deepFreeze({ status: 'PASS', path: 'generated_validated_checkpoint', profile_id: profile.profile, assessment_id: profile.assessment_id, checkpoint: checkpointSummary(checkpoint), persistence });
    } catch (error) {
      if (error?.background_pending) {
        return deepFreeze({ status: 'ADVANCING', path: 'provider_background_in_progress', profile_id: profile.profile, assessment_id: profile.assessment_id, active_stage: stage, provider_calls: 0 });
      }
      await assertSourceAuthorityCurrent(profile, source, expectedAuthority, expectedRealizationIdentity);
      await appendFailure(redis, config, profile.profile, stage, error);
      throw error;
    }
  }

  async function assembleCandidate(profileId, expectedAuthority = null, expectedRealizationIdentity = null) {
    const { profile, source, sourceGuards, compatibility, identity } = await contextFor(profileId, expectedAuthority, expectedRealizationIdentity);
    const generationIdentitySha256 = generationIdentityFor(source, config.providerModel);
    const checkpoints = await Promise.all(STAGES.map((stage) => readCheckpoint(redis, config, profile, generationIdentitySha256, stage)));
    invariant(checkpoints.every(Boolean), 'new_ba_real_profile_campaign_all_checkpoints_required');
    const providerAccounting = aggregateProviderAccounting(checkpoints);
    const artifact = buildRealProfileNewBaRealization({
      source, cassetteRegistry, projectionAdapters,
      displayName: profile.display_name,
      wbm: checkpoints[0].artifact,
      futures: checkpoints[1].artifact,
      oneMove: checkpoints[2].artifact,
      providerAccounting,
    });
    const validation = validateCompleteNewBaRealization(artifact, { profileId: profile.profile, assessmentId: profile.assessment_id });
    return deepFreeze({ profile, source, sourceGuards, checkpoints, providerAccounting, artifact, validation, compatibility, identity });
  }

  async function generate(profileId, expectedAuthority = null, expectedRealizationIdentity = null) {
    for (const stage of STAGES) await generateStage(profileId, stage, expectedAuthority, expectedRealizationIdentity);
    const candidate = await assembleCandidate(profileId, expectedAuthority, expectedRealizationIdentity);
    return deepFreeze({
      artifact: candidate.artifact,
      provider_accounting: candidate.providerAccounting,
      validation: candidate.validation,
      source_realization_identity: sourceIdentityReceipt(candidate.identity),
    });
  }

  async function advance(profileId, expectedAuthority = null, expectedRealizationIdentity = null) {
    const { profile, source } = await contextFor(profileId, expectedAuthority, expectedRealizationIdentity);
    const generationIdentitySha256 = generationIdentityFor(source, config.providerModel);
    const checkpoints = await Promise.all(STAGES.map((stage) => readCheckpoint(redis, config, profile, generationIdentitySha256, stage)));
    const nextStageIndex = checkpoints.findIndex((checkpoint) => !checkpoint);
    if (nextStageIndex >= 0) {
      const nextStage = STAGES[nextStageIndex];
      const advanced = await generateStage(profile.profile, nextStage, expectedAuthority, expectedRealizationIdentity);
      if (advanced.status === 'ADVANCING') {
        return deepFreeze({ complete: false, status: 'ADVANCING', profile_id: profile.profile, assessment_id: profile.assessment_id, accepted_stage: null, active_stage: nextStage, next_stage: nextStage });
      }
      if (nextStageIndex < STAGES.length - 1) {
        return deepFreeze({
          complete: false,
          status: 'ADVANCING',
          profile_id: profile.profile,
          assessment_id: profile.assessment_id,
          accepted_stage: nextStage,
          checkpoint: advanced.checkpoint,
          next_stage: STAGES[nextStageIndex + 1],
        });
      }
    }
    const candidate = await assembleCandidate(profile.profile, expectedAuthority, expectedRealizationIdentity);
    const openPlan = candidate.validation.status === NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN;
    return deepFreeze({
      complete: true,
      status: openPlan ? 'COMPLETE_WITH_OPEN_PLAN' : 'COMPLETE',
      artifact: candidate.artifact,
      provider_accounting: candidate.providerAccounting,
      validation: candidate.validation,
      source_realization_identity: sourceIdentityReceipt(candidate.identity),
    });
  }

  async function publish(profileId, expectedAuthority = null, expectedRealizationIdentity = null) {
    const candidate = await assembleCandidate(profileId, expectedAuthority, expectedRealizationIdentity);
    const { profile, sourceGuards, providerAccounting, artifact, validation, compatibility, identity } = candidate;
    const before = await realizationStore.inspect({ profileId: profile.profile, desiredIdentity: identity });
    if (before.state === 'current') {
      invariant(before.current.artifact_sha256 === sha256Stable(artifact), 'new_ba_real_profile_campaign_existing_current_conflict');
      return deepFreeze({ status: validation.status, path: 'current_fast_path', profile_id: profile.profile, assessment_id: profile.assessment_id, realization_id: before.pointer, artifact_sha256: before.current.artifact_sha256, validation, provider_accounting: providerAccounting });
    }
    const envelope = buildLaunchSafeNewBaEnvelope({ profileId: profile.profile, realizationIdentity: identity, artifact, compatibility, providerAccounting });
    await assertSourceAuthorityCurrent(profile, candidate.source, expectedAuthority, expectedRealizationIdentity);
    const persistence = await realizationStore.persistImmutable(envelope);
    await assertSourceAuthorityCurrent(profile, candidate.source, expectedAuthority, expectedRealizationIdentity);
    const pointer = await realizationStore.advancePointer({
      profileId: profile.profile,
      expectedCurrentId: before.pointer,
      nextRealizationId: envelope.realization_id,
      sourceGuards,
    });
    const after = await realizationStore.inspect({ profileId: profile.profile, desiredIdentity: identity });
    invariant(after.state === 'current' && after.pointer === envelope.realization_id, 'new_ba_real_profile_campaign_atomic_publication_failed');
    return deepFreeze({
      status: validation.status, path: before.state === 'missing' ? 'published_missing' : 'published_stale',
      profile_id: profile.profile, assessment_id: profile.assessment_id,
      realization_id: envelope.realization_id, realization_sha256: envelope.realization_identity.sha256,
      artifact_sha256: envelope.artifact_sha256, completeness: envelope.completeness.status,
      inspectable_object_count: envelope.completeness.inspectable_object_count,
      persistence, pointer, provider_accounting: providerAccounting,
      validation,
    });
  }

  return deepFreeze({ status, preflight, relationshipDiagnostic, generateStage, generate, advance, publish });
}

export { REFERENCE_PROFILES as REAL_PROFILE_NEW_BA_REFERENCE_PROFILES, STAGES as REAL_PROFILE_NEW_BA_STAGES };
