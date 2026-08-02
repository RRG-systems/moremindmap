import process from 'node:process';

import OpenAI from 'openai';

import { checkLayer3RateLimit } from '../engine/bosCustomerIntelligence/redisTranslationStore.js';
import { getOrGenerateLayer3Translation } from '../engine/bosCustomerIntelligence/translationService.js';
import { verifyExistingProfilePacket } from '../engine/bosCustomerIntelligence/profilePacketVerifier.js';
import {
  BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
} from '../../src/lib/bosCustomerIntelligence/contracts.js';
import { validateLayer3SemanticPacket } from '../../src/lib/bosCustomerIntelligence/translationValidator.js';
import { createRedisClient, normalizeProfileId } from './visual-dna/shared.js';

const MAX_PACKET_CHARACTERS = 180000;

function featureEnabled() {
  return process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED === 'true';
}

function clientAddress(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!featureEnabled()) {
    return res.status(404).json({ error: 'feature_disabled' });
  }
  if (!process.env.OPENAI_API_KEY || !process.env.REDIS_URL) {
    return res.status(503).json({ error: 'translation_service_unavailable' });
  }

  const parsedProfileId = normalizeProfileId(req.body?.profile_id);
  const packet = req.body?.packet;
  if (!parsedProfileId) return res.status(400).json({ error: 'invalid_profile_id' });
  if (!packet || JSON.stringify(packet).length > MAX_PACKET_CHARACTERS) {
    return res.status(400).json({ error: 'invalid_packet_size' });
  }
  const packetValidation = validateLayer3SemanticPacket(packet);
  if (!packetValidation.valid) {
    return res.status(400).json({
      error: 'semantic_packet_rejected',
      failures: packetValidation.failures,
    });
  }

  const redis = createRedisClient();
  try {
    const rate = await checkLayer3RateLimit(redis, {
      profileId: parsedProfileId.canonical,
      clientAddress: clientAddress(req),
    });
    res.setHeader?.('X-RateLimit-Limit', String(rate.limit));
    res.setHeader?.('X-RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) return res.status(429).json({ error: 'rate_limit_exceeded' });

    let authoritative;
    try {
      authoritative = await verifyExistingProfilePacket({
        redis,
        profileId: parsedProfileId.canonical,
        suppliedPacket: packet,
      });
    } catch (error) {
      return res.status(error.status || 403).json({
        error: error.message || 'profile_packet_verification_failed',
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: BOS_CUSTOMER_INTELLIGENCE_TIMEOUT_MS,
    });
    const transport = (request, options) => openai.responses.create(request, options);
    const result = await getOrGenerateLayer3Translation({
      redis,
      packet: authoritative.packet,
      transport,
    });
    return res.status(200).json(result);
  } catch {
    return res.status(503).json({ error: 'translation_service_unavailable' });
  } finally {
    redis.disconnect();
  }
}
