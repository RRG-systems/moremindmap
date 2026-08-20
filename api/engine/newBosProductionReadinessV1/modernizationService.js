import { attachCustomerTopProjection } from '../../../src/lib/newBosPersonalityDnaV1/topProjection.js';

import { adaptCanonicalProfileToNewBosRawEvidence } from './canonicalAdapter.js';
import { classifyNewBosCompatibility } from './compatibility.js';
import { completeNewBosCandidate, validateCompleteNewBosCandidate } from './completeness.js';
import { authorizeNewBosRead } from './config.js';
import { createNewBosLaunchDiagnostics } from './diagnostics.js';
import { buildLaunchSafeRealizationEnvelope } from './launchSafeRealizationStore.js';
import { buildNewBosRealizationIdentity } from './realizationIdentity.js';

function publicArtifact(artifact) {
  return Object.freeze({
    version: artifact.version,
    real_profile_gate: true,
    profile_id: artifact.profile_id,
    subject_token: artifact.subject_token,
    identity_context: artifact.identity_context,
    canonical_scores: artifact.canonical_scores,
    personality_dna: artifact.personality_dna,
    whole_person_model: artifact.whole_person_model,
    surface_packets: artifact.surface_packets,
    top_projection: artifact.top_projection,
  });
}

export function createNewBosModernizationService({
  config,
  canonicalReader,
  realizationStore,
  singleFlight,
  generator,
  diagnostics = createNewBosLaunchDiagnostics(),
} = {}) {
  if (typeof canonicalReader?.read !== 'function') throw new Error('new_bos_modernization_canonical_reader_required');
  if (typeof realizationStore?.inspect !== 'function') throw new Error('new_bos_modernization_store_required');
  if (typeof singleFlight?.run !== 'function') throw new Error('new_bos_modernization_single_flight_required');

  async function desiredState(profileId) {
    const canonicalEnvelope = await canonicalReader.read(profileId);
    const rawEvidence = adaptCanonicalProfileToNewBosRawEvidence({ envelope: canonicalEnvelope, expectedProfileId: profileId });
    const compatibility = classifyNewBosCompatibility(rawEvidence);
    diagnostics.record('compatibility_classified', { profile_id: profileId, compatibility_class: compatibility.class });
    if (!compatibility.automatic_rebuild) {
      const error = new Error(`new_bos_modernization_requires_evidence_or_review:${compatibility.class}`);
      error.compatibility = compatibility;
      throw error;
    }
    const identity = buildNewBosRealizationIdentity({
      profileId,
      canonicalSourceSha256: rawEvidence.generation_metadata.canonical_source_sha256,
      rawEvidenceVersion: rawEvidence.version,
      providerModel: config.providerModel,
      compatibilityClass: compatibility.class,
    });
    return { rawEvidence, compatibility, identity };
  }

  async function serveEnvelope(envelope, path) {
    validateCompleteNewBosCandidate(envelope.artifact);
    return Object.freeze({
      artifact: publicArtifact(envelope.artifact),
      receipt: Object.freeze({
        path,
        profile_id: envelope.profile_id,
        realization_id: envelope.realization_id,
        realization_sha256: envelope.realization_identity.sha256,
        artifact_sha256: envelope.artifact_sha256,
        compatibility_class: envelope.compatibility.class,
        completeness_count: envelope.complete_surface_count,
        provider_accounting: envelope.provider_accounting,
        production_active: config.customerActive,
      }),
    });
  }

  return Object.freeze({
    diagnostics,
    async diagnose({ profileId, suppliedToken = '' }) {
      const normalized = authorizeNewBosRead({ config, profileId, suppliedToken });
      diagnostics.record('request_authorized', { profile_id: normalized, feature_state: config.customerActive ? 'customer_active' : 'canary' });
      const desired = await desiredState(normalized);
      const current = await realizationStore.inspect({ profileId: normalized, desiredIdentity: desired.identity });
      return Object.freeze({
        status: 'ok',
        feature_state: config.customerActive ? 'customer_active' : 'private_canary',
        customer_active: config.customerActive,
        ba_fusion_validated: config.baFusionValidated,
        provider_enabled: config.providerEnabled,
        persistence_enabled: config.persistenceEnabled,
        namespace_class: config.namespace.split(':').slice(0, 3).join(':'),
        profile_id: normalized,
        compatibility_class: desired.compatibility.class,
        realization_state: current.state,
        desired_realization_id: desired.identity.realization_id,
        current_realization_id: current.pointer,
        complete_surface_count: current.current?.complete_surface_count || 0,
        diagnostics: diagnostics.snapshot(),
      });
    },
    async retrieve({ profileId, suppliedToken = '' }) {
      const normalized = authorizeNewBosRead({ config, profileId, suppliedToken });
      diagnostics.record('request_authorized', { profile_id: normalized, feature_state: config.customerActive ? 'customer_active' : 'canary' });
      const desired = await desiredState(normalized);
      const initial = await realizationStore.inspect({ profileId: normalized, desiredIdentity: desired.identity });
      if (initial.state === 'current') {
        diagnostics.record('current_fast_path', { profile_id: normalized, realization_id: initial.pointer, completeness_count: initial.current.complete_surface_count });
        return serveEnvelope(initial.current, 'current_fast_path');
      }
      if (!config.providerEnabled || typeof generator !== 'function') {
        diagnostics.record('provider_disabled', { profile_id: normalized, realization_state: initial.state });
        throw new Error('new_bos_modernization_provider_default_off');
      }

      return singleFlight.run(desired.identity.sha256, async () => {
        const rechecked = await realizationStore.inspect({ profileId: normalized, desiredIdentity: desired.identity });
        if (rechecked.state === 'current') return serveEnvelope(rechecked.current, 'joined_or_rechecked_current');
        diagnostics.record('rebuild_started', { profile_id: normalized, realization_id: desired.identity.realization_id, prior_state: rechecked.state });
        const startedAt = Date.now();
        try {
          const generated = await generator({
            rawEvidence: desired.rawEvidence,
            providerModel: config.providerModel,
            compatibility: desired.compatibility,
            realizationIdentity: desired.identity,
          });
          const completed = completeNewBosCandidate(generated.artifact || generated).candidate;
          const projected = attachCustomerTopProjection(completed);
          validateCompleteNewBosCandidate(projected);
          const envelope = buildLaunchSafeRealizationEnvelope({
            profileId: normalized,
            realizationIdentity: desired.identity,
            artifact: projected,
            compatibility: desired.compatibility,
            providerAccounting: generated.provider_accounting || {},
          });
          const persistence = await realizationStore.persistImmutable(envelope);
          diagnostics.record('artifact_persisted', { profile_id: normalized, realization_id: envelope.realization_id, artifact_sha256: envelope.artifact_sha256, written: persistence.written });
          await realizationStore.advancePointer({
            profileId: normalized,
            expectedCurrentId: rechecked.pointer,
            nextRealizationId: envelope.realization_id,
          });
          diagnostics.record('pointer_advanced', { profile_id: normalized, realization_id: envelope.realization_id });
          diagnostics.record('rebuild_succeeded', {
            profile_id: normalized,
            realization_id: envelope.realization_id,
            completeness_count: envelope.complete_surface_count,
            latency_ms: Date.now() - startedAt,
            provider_calls: envelope.provider_accounting.calls || 0,
            estimated_cost_usd: envelope.provider_accounting.estimated_cost_usd || 0,
          });
          return serveEnvelope(envelope, rechecked.state === 'missing' ? 'rebuilt_missing' : 'rebuilt_stale');
        } catch (error) {
          diagnostics.record('rebuild_failed', { profile_id: normalized, error_code: error?.message || error?.name, latency_ms: Date.now() - startedAt });
          throw error;
        }
      }, {
        awaitExisting: async () => {
          const joined = await realizationStore.inspect({ profileId: normalized, desiredIdentity: desired.identity });
          return joined.state === 'current' ? serveEnvelope(joined.current, 'distributed_single_flight_join') : null;
        },
      });
    },
  });
}
