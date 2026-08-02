import { retrieveCanonicalProfile } from '../../moremindmap/visual-dna/shared.js';
import { buildLayer3SemanticPacket, stableStringify } from '../../../src/lib/bosCustomerIntelligence/semanticPacket.js';
import { validateLayer3SemanticPacket } from '../../../src/lib/bosCustomerIntelligence/translationValidator.js';
import { buildNarrativeV3 } from '../../../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildCustomerBOSViewModel } from '../../../src/lib/reports/buildCustomerBOSViewModel.js';

function rankedDimensions(canonical) {
  const data = canonical?.canonical_profile_json
    || canonical?.canonical_dossier?.canonical_profile_json
    || canonical
    || {};
  return data.rescoring_gpt?.ranked_dimensions?.length > 0
    ? data.rescoring_gpt.ranked_dimensions
    : data.rescoring_v1?.ranked_dimensions?.length > 0
      ? data.rescoring_v1.ranked_dimensions
      : data.ranked_dimensions || [];
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function buildAuthoritativeLayer3Packet({ redis, profileId }) {
  const retrieved = await retrieveCanonicalProfile(redis, profileId);
  if (!retrieved.ok) throw statusError(retrieved.error, retrieved.status);

  const canonical = retrieved.canonicalDossier;
  const narrative = await buildNarrativeV3(canonical, false, null, true);
  const viewModel = buildCustomerBOSViewModel({
    canonical,
    narrative,
    profileId: retrieved.profile_id,
    personName: canonical?.person_name,
    company: canonical?.company_name || '',
    ranked: rankedDimensions(canonical),
  });
  const packet = buildLayer3SemanticPacket(viewModel);
  const validation = validateLayer3SemanticPacket(packet);
  if (!validation.valid) throw statusError('authoritative_semantic_packet_rejected', 422);

  return Object.freeze({
    profile_id: retrieved.profile_id,
    retrieved_key: retrieved.retrievedKey,
    packet,
    view_model_shape: Object.freeze({
      tabs: viewModel.tabs?.length || 0,
      overview_sections: viewModel.overviewSections?.length || 0,
    }),
  });
}

export async function verifyExistingProfilePacket({ redis, profileId, suppliedPacket }) {
  const authoritative = await buildAuthoritativeLayer3Packet({ redis, profileId });
  if (stableStringify(authoritative.packet) !== stableStringify(suppliedPacket)) {
    throw statusError('semantic_packet_does_not_match_profile', 409);
  }
  return authoritative;
}
