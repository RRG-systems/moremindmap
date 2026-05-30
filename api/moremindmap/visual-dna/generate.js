import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { extractBehavioralIntelligence } from '../../engine/canonical/extractIntelligence.js';
import { buildNarrativeV3 } from '../../../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildVisualDNAContextPacket, buildVisualDNAPrompt, getVisualDNADesignReference } from '../../../src/lib/visualDNA/index.js';
import {
  VISUAL_DNA_MODEL,
  VISUAL_DNA_PROVIDER,
  VISUAL_DNA_VERSION,
  createRedisClient,
  hashObject,
  isApprovedVisualDNA,
  isCurrentVisualDNA,
  isVisualDNAEnabled,
  readVisualDNAMetadata,
  retrieveCanonicalProfile,
  writeVisualDNAMetadata,
} from './shared.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isVisualDNAEnabled()) {
    return res.status(200).json({
      enabled: false,
      status: 'disabled',
      message: 'Visual DNA is disabled.',
    });
  }

  const { profile_id, force = false, debug = false } = req.body || {};

  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id required' });
  }

  let redis;

  try {
    redis = createRedisClient();

    const profileResult = await retrieveCanonicalProfile(redis, profile_id);
    if (!profileResult.ok) {
      return res.status(profileResult.status || 500).json(profileResult);
    }

    const { canonicalDossier, profile_id: normalizedProfileId } = profileResult;
    const canonicalData = canonicalDossier?.canonical_profile_json || canonicalDossier;
    const behavioralIntelligence = safelyExtractBehavioralIntelligence(canonicalDossier);
    const narrative = await buildNarrativeV3(
      canonicalDossier,
      false,
      normalizedProfileId,
      true,
      true
    );
    const ranked = getRankedDimensions(canonicalData);
    const contextPacket = buildVisualDNAContextPacket({
      canonical: canonicalDossier,
      narrative,
      behavioralIntelligence,
      ranked,
      profileId: normalizedProfileId,
      personName: canonicalDossier?.person_name || canonicalData?.metadata?.person_name,
      company: canonicalDossier?.company_name || canonicalData?.metadata?.company_name,
    });
    const promptResult = buildVisualDNAPrompt(contextPacket, getVisualDNADesignReference());
    const profileHash = hashObject(contextPacket);
    const existing = await readVisualDNAMetadata(redis, normalizedProfileId);

    if (!force && isApprovedVisualDNA(existing)) {
      return res.status(200).json({
        enabled: true,
        status: 'reused_approved',
        generated: false,
        visual_dna: existing,
        debug: debug ? {
          profile_hash: profileHash,
          prompt_hash: promptResult.prompt_hash,
          retrieved_key: profileResult.retrievedKey,
          approval_status: existing.status,
        } : undefined,
      });
    }

    if (!force && isCurrentVisualDNA(existing, {
      prompt_hash: promptResult.prompt_hash,
      profile_hash: profileHash,
    })) {
      return res.status(200).json({
        enabled: true,
        status: 'reused',
        generated: false,
        visual_dna: existing,
        debug: debug ? {
          profile_hash: profileHash,
          prompt_hash: promptResult.prompt_hash,
          retrieved_key: profileResult.retrievedKey,
        } : undefined,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        enabled: true,
        status: 'generation_failed',
        error: 'OPENAI_API_KEY is not configured',
      });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        enabled: true,
        status: 'storage_not_configured',
        error: 'BLOB_READ_WRITE_TOKEN is not configured',
      });
    }

    const imageBuffer = await generateImageBuffer(promptResult.prompt);
    const pathname = `visual-dna/${normalizedProfileId}/${promptResult.prompt_hash}.png`;
    const blob = await put(pathname, imageBuffer, {
      access: 'public',
      allowOverwrite: true,
      contentType: 'image/png',
      cacheControlMaxAge: 31536000,
    });

    const metadata = {
      profile_id: normalizedProfileId,
      image_url: blob.url,
      prompt_hash: promptResult.prompt_hash,
      profile_hash: profileHash,
      generated_at: new Date().toISOString(),
      model: VISUAL_DNA_MODEL,
      provider: VISUAL_DNA_PROVIDER,
      visual_dna_version: VISUAL_DNA_VERSION,
      design_reference_version: promptResult.design_reference_version,
      status: 'draft',
      approved: false,
    };

    await writeVisualDNAMetadata(redis, metadata);

    return res.status(200).json({
      enabled: true,
      status: 'generated',
      generated: true,
      visual_dna: metadata,
      debug: debug ? {
        profile_hash: profileHash,
        prompt_hash: promptResult.prompt_hash,
        prompt: promptResult.prompt,
        retrieved_key: profileResult.retrievedKey,
        blob_pathname: blob.pathname,
      } : undefined,
    });
  } catch (error) {
    console.error('[VISUAL DNA GENERATE] Error:', error);
    return res.status(500).json({
      enabled: true,
      status: 'generation_failed',
      error: error.message,
    });
  } finally {
    if (redis) {
      await redis.disconnect().catch(() => {});
    }
  }
}

function safelyExtractBehavioralIntelligence(canonicalDossier) {
  try {
    return extractBehavioralIntelligence(canonicalDossier);
  } catch (error) {
    console.error('[VISUAL DNA] Behavioral extraction failed:', error.message);
    return null;
  }
}

function getRankedDimensions(data) {
  if (Array.isArray(data?.rescoring_gpt?.ranked_dimensions) && data.rescoring_gpt.ranked_dimensions.length > 0) {
    return data.rescoring_gpt.ranked_dimensions;
  }
  if (Array.isArray(data?.rescoring_v1?.ranked_dimensions) && data.rescoring_v1.ranked_dimensions.length > 0) {
    return data.rescoring_v1.ranked_dimensions;
  }
  return data?.ranked_dimensions || [];
}

async function generateImageBuffer(prompt) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageResponse = await openai.images.generate({
    model: VISUAL_DNA_MODEL,
    prompt,
    size: '1536x1024',
    quality: 'medium',
    output_format: 'png',
    n: 1,
  });

  const firstImage = imageResponse?.data?.[0];
  if (!firstImage?.b64_json) {
    throw new Error('OpenAI image generation returned no image data');
  }

  return Buffer.from(firstImage.b64_json, 'base64');
}
