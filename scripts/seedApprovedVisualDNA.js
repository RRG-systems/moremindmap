import { extractBehavioralIntelligence } from '../api/engine/canonical/extractIntelligence.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildVisualDNAContextPacket, buildVisualDNAPrompt, getVisualDNADesignReference } from '../src/lib/visualDNA/index.js';
import {
  VISUAL_DNA_VERSION,
  createRedisClient,
  hashObject,
  retrieveCanonicalProfile,
  writeVisualDNAMetadata,
} from '../api/moremindmap/visual-dna/shared.js';

const APPROVED_VISUALS = [
  {
    profile_id: 'mm-20260529-ceo8x7q2',
    image_url: 'https://moremindmap.com/visual-dna-test/marcus-vale.png',
  },
  {
    profile_id: 'mm-20260529-acc2f9d6',
    image_url: 'https://moremindmap.com/visual-dna-test/nora-bell.png',
  },
];

function getRankedDimensions(data) {
  if (Array.isArray(data?.rescoring_gpt?.ranked_dimensions) && data.rescoring_gpt.ranked_dimensions.length > 0) {
    return data.rescoring_gpt.ranked_dimensions;
  }
  if (Array.isArray(data?.rescoring_v1?.ranked_dimensions) && data.rescoring_v1.ranked_dimensions.length > 0) {
    return data.rescoring_v1.ranked_dimensions;
  }
  return data?.ranked_dimensions || [];
}

async function buildApprovedMetadata(redis, visual) {
  const profileResult = await retrieveCanonicalProfile(redis, visual.profile_id);
  if (!profileResult.ok) {
    throw new Error(`${visual.profile_id}: ${profileResult.error || 'profile not found'}`);
  }

  const { canonicalDossier, profile_id: normalizedProfileId } = profileResult;
  const canonicalData = canonicalDossier?.canonical_profile_json || canonicalDossier;
  const behavioralIntelligence = extractBehavioralIntelligence(canonicalDossier);
  const narrative = await buildNarrativeV3(
    canonicalDossier,
    false,
    normalizedProfileId,
    true,
    true
  );

  const contextPacket = buildVisualDNAContextPacket({
    canonical: canonicalDossier,
    narrative,
    behavioralIntelligence,
    ranked: getRankedDimensions(canonicalData),
    profileId: normalizedProfileId,
    personName: canonicalDossier?.person_name || canonicalData?.metadata?.person_name,
    company: canonicalDossier?.company_name || canonicalData?.metadata?.company_name,
  });
  const promptResult = buildVisualDNAPrompt(contextPacket, getVisualDNADesignReference());

  return {
    profile_id: normalizedProfileId,
    image_url: visual.image_url,
    prompt_hash: promptResult.prompt_hash,
    profile_hash: hashObject(contextPacket),
    generated_at: new Date().toISOString(),
    model: 'manual-approved',
    provider: 'curated_static',
    visual_dna_version: VISUAL_DNA_VERSION,
    design_reference_version: promptResult.design_reference_version,
    status: 'approved',
    approved: true,
  };
}

async function main() {
  const redis = createRedisClient();
  try {
    for (const visual of APPROVED_VISUALS) {
      const metadata = await buildApprovedMetadata(redis, visual);
      await writeVisualDNAMetadata(redis, metadata);
      console.log(JSON.stringify(metadata, null, 2));
    }
  } finally {
    await redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
