import { authorizeNewBaRead } from './config.js';
import { classifyNewBaCompatibility } from './compatibility.js';
import { validateCompleteNewBaRealization } from './completeness.js';
import { createNewBaDiagnostics } from './diagnostics.js';
import { buildLaunchSafeNewBaEnvelope } from './launchSafeRealizationStore.js';
import { buildNewBaRealizationIdentityV3 } from './realizationIdentity.js';
import { buildCustomerSafePresentationViewModel } from '../../../src/lib/baProgressiveDisclosureV1/customerPresentationSanitizer.js';
import { classifyCompatiblePriorRealization } from './compatibilitySelection.js';

function publicArtifact(envelope, fusionValidated, customerActive) {
  return Object.freeze({
    contract_id: 'new-ba-customer-projection-v1',
    version: envelope.artifact.version,
    profile_id: envelope.profile_id,
    assessment_id: envelope.assessment_id,
    realization_id: envelope.realization_id,
    customer_view_model: buildCustomerSafePresentationViewModel(envelope.artifact.customer_view_model),
    state: Object.freeze({
      compatibility_class: envelope.compatibility.class,
      completeness: 'COMPLETE',
      candidate_version: envelope.artifact.authority.production_candidate_version,
      projection_version: envelope.artifact.authority.projection_version,
      customer_activation: customerActive,
      bos_ba_fusion_gate: fusionValidated ? (customerActive ? 'VALIDATED_COMPATIBLE_CUSTOMER_ACTIVE' : 'VALIDATED_PRIVATE_ACTIVATION_OFF') : 'CLOSED',
      vertical_state: Object.freeze({
        vertical_id: envelope.realization_identity.components.vertical_id || 'real_estate',
        label: envelope.artifact.customer_view_model?.vertical?.label || 'Real Estate',
      }),
    }),
  });
}

export function createNewBaModernizationService({
  config,
  authorityReader,
  realizationStore,
  singleFlight,
  generator = null,
  diagnostics = createNewBaDiagnostics(),
} = {}) {
  if (typeof authorityReader?.read !== 'function') throw new Error('new_ba_service_authority_reader_required');
  if (typeof realizationStore?.inspect !== 'function') throw new Error('new_ba_service_realization_store_required');
  if (typeof singleFlight?.run !== 'function') throw new Error('new_ba_service_single_flight_required');

  async function desiredState(profileId) {
    const source = await authorityReader.read(profileId);
    if (source.profile_id !== profileId || source.business_evidence?.profile_id !== profileId || source.bos_authority?.profile_id !== profileId) throw new Error('new_ba_service_cross_profile_contamination');
    const compatibility = classifyNewBaCompatibility(source);
    diagnostics.record('compatibility_classified', { profile_id: profileId, compatibility_class: compatibility.class });
    if (!compatibility.automatic_rebuild) throw new Error(`new_ba_modernization_requires_evidence_or_review:${compatibility.class}`);
    const identity = buildNewBaRealizationIdentityV3({
      profileId,
      assessmentId: source.assessment_id,
      evidenceSha256: source.business_evidence.evidence_sha256,
      bosAuthoritySha256: source.bos_authority.sha256,
      bosFusionContractSha256: source.bos_authority.fusion_contract_sha256,
      bosEvidenceBoundarySha256: source.bos_authority.evidence_boundary_sha256,
      compatibilityClass: compatibility.class,
      providerModel: config.providerModel,
      verticalBinding: source.business_evidence.vertical_binding,
    });
    return Object.freeze({ source, compatibility, identity });
  }

  function serve(envelope, path) {
    validateCompleteNewBaRealization(envelope.artifact);
    return Object.freeze({
      artifact: publicArtifact(envelope, config.fusionValidated, config.customerActive),
      receipt: Object.freeze({
        path,
        profile_id: envelope.profile_id,
        assessment_id: envelope.assessment_id,
        realization_id: envelope.realization_id,
        realization_sha256: envelope.realization_identity.sha256,
        artifact_sha256: envelope.artifact_sha256,
        compatibility_class: envelope.compatibility.class,
        completeness: envelope.completeness.status,
        inspectable_object_count: envelope.completeness.inspectable_object_count,
        provider_calls: envelope.provider_accounting.calls || 0,
        store: false,
        production_customer_active: config.customerActive,
        fusion_gate: config.fusionValidated ? (config.customerActive ? 'VALIDATED_COMPATIBLE_CUSTOMER_ACTIVE' : 'VALIDATED_PRIVATE_ACTIVATION_OFF') : 'CLOSED',
        vertical_id: envelope.realization_identity.components.vertical_id || 'real_estate',
        cassette_id: envelope.realization_identity.components.cassette_id || envelope.realization_identity.components.cassette_version,
      }),
    });
  }

  function pending(profile, desired, path, progress = null) {
    return Object.freeze({
      pending: true,
      status: 'GENERATION_ADVANCING',
      profile_id: profile,
      assessment_id: desired.source.assessment_id,
      desired_realization_id: desired.identity.realization_id,
      compatibility_class: desired.compatibility.class,
      path,
      accepted_stage: progress?.accepted_stage || null,
      next_stage: progress?.next_stage || null,
      provider_calls_accepted_this_request: progress?.accepted_stage ? 1 : 0,
      retry_after_ms: 1500,
    });
  }

  return Object.freeze({
    diagnostics,
    async diagnose({ profileId, suppliedToken = '' }) {
      const profile = authorizeNewBaRead({ config, profileId, suppliedToken });
      diagnostics.record('request_authorized', { profile_id: profile, feature_state: config.customerActive ? 'customer_active' : 'private_canary' });
      const desired = await desiredState(profile);
      const current = await realizationStore.inspect({ profileId: profile, desiredIdentity: desired.identity });
      const priorCompatibility = current.state === 'stale'
        ? classifyCompatiblePriorRealization({ current: current.current, desiredIdentity: desired.identity })
        : null;
      return Object.freeze({
        status: 'ok',
        feature_state: config.customerActive ? 'customer_active' : 'private_canary',
        customer_active: config.customerActive,
        bos_ba_fusion_validated: config.fusionValidated,
        provider_enabled: config.providerEnabled,
        persistence_enabled: config.persistenceEnabled,
        namespace_class: config.namespace.split(':').slice(0, 3).join(':'),
        profile_id: profile,
        assessment_id: desired.source.assessment_id,
        compatibility_class: desired.compatibility.class,
        realization_state: current.state,
        retrieval_compatibility: priorCompatibility?.serveable ? 'COMPATIBLE_PRIOR_AVAILABLE' : current.state === 'current' ? 'CURRENT' : 'REBUILD_REQUIRED',
        desired_realization_id: desired.identity.realization_id,
        current_realization_id: current.pointer,
        bos_authority_version: desired.source.bos_authority.version,
        bos_fusion_contract_sha256: desired.source.bos_authority.fusion_contract_sha256,
        bos_evidence_boundary_sha256: desired.source.bos_authority.evidence_boundary_sha256,
        cassette_version: 'real-estate-cassette-v1',
        completeness: current.current?.completeness?.status || 'NOT_PUBLISHED',
        diagnostics: diagnostics.snapshot(),
      });
    },
    async retrieve({ profileId, suppliedToken = '' }) {
      const profile = authorizeNewBaRead({ config, profileId, suppliedToken });
      diagnostics.record('request_authorized', { profile_id: profile, feature_state: config.customerActive ? 'customer_active' : 'private_canary' });
      const desired = await desiredState(profile);
      const initial = await realizationStore.inspect({ profileId: profile, desiredIdentity: desired.identity });
      if (initial.state === 'current') {
        diagnostics.record('current_fast_path', { profile_id: profile, realization_id: initial.pointer });
        return serve(initial.current, 'current_fast_path');
      }
      const priorCompatibility = classifyCompatiblePriorRealization({ current: initial.current, desiredIdentity: desired.identity });
      if (initial.state === 'stale' && priorCompatibility.serveable) {
        diagnostics.record('compatible_prior_fast_path', {
          profile_id: profile,
          realization_id: initial.pointer,
          drift_fields: priorCompatibility.drift_fields,
          uses_recorded_bos_fusion_snapshot: true,
        });
        return serve(initial.current, 'compatible_prior_fast_path');
      }
      if (!config.persistenceEnabled || (typeof generator?.generate !== 'function' && typeof generator?.advance !== 'function')) {
        diagnostics.record('provider_disabled', { profile_id: profile, realization_state: initial.state });
        throw new Error('new_ba_modernization_rebuild_default_off');
      }
      return singleFlight.run(desired.identity.sha256, async () => {
        const rechecked = await realizationStore.inspect({ profileId: profile, desiredIdentity: desired.identity });
        if (rechecked.state === 'current') return serve(rechecked.current, 'joined_or_rechecked_current');
        diagnostics.record('rebuild_started', { profile_id: profile, realization_id: desired.identity.realization_id, prior_state: rechecked.state });
        const started = Date.now();
        try {
          const generated = typeof generator.advance === 'function'
            ? await generator.advance({ source: desired.source, realizationIdentity: desired.identity, compatibility: desired.compatibility })
            : await generator.generate({ source: desired.source, realizationIdentity: desired.identity, compatibility: desired.compatibility });
          if (generated?.complete === false) {
            diagnostics.record('generation_stage_accepted', { profile_id: profile, accepted_stage: generated.accepted_stage, next_stage: generated.next_stage, latency_ms: Date.now() - started });
            return pending(profile, desired, 'generation_stage_accepted', generated);
          }
          validateCompleteNewBaRealization(generated.artifact, { profileId: profile, assessmentId: desired.source.assessment_id });
          const envelope = buildLaunchSafeNewBaEnvelope({
            profileId: profile,
            realizationIdentity: desired.identity,
            artifact: generated.artifact,
            compatibility: desired.compatibility,
            providerAccounting: generated.provider_accounting,
          });
          const persistence = await realizationStore.persistImmutable(envelope);
          diagnostics.record('artifact_persisted', { profile_id: profile, realization_id: envelope.realization_id, written: persistence.written });
          await realizationStore.advancePointer({ profileId: profile, expectedCurrentId: rechecked.pointer, nextRealizationId: envelope.realization_id });
          diagnostics.record('pointer_advanced', { profile_id: profile, realization_id: envelope.realization_id });
          diagnostics.record('rebuild_succeeded', { profile_id: profile, realization_id: envelope.realization_id, latency_ms: Date.now() - started, provider_calls: envelope.provider_accounting.calls || 0 });
          return serve(envelope, rechecked.state === 'missing' ? 'rebuilt_missing' : 'rebuilt_stale');
        } catch (error) {
          diagnostics.record('rebuild_failed', { profile_id: profile, error_code: error?.message || error?.name, latency_ms: Date.now() - started });
          throw error;
        }
      }, {
        awaitExisting: async () => {
          const joined = await realizationStore.inspect({ profileId: profile, desiredIdentity: desired.identity });
          if (joined.state === 'current') return serve(joined.current, 'distributed_single_flight_join');
          if (typeof generator.advance === 'function') return pending(profile, desired, 'distributed_generation_in_flight');
          return null;
        },
      });
    },
  });
}
