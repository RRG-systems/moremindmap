import process from 'node:process';

import OpenAI from 'openai';

import { translateLayer3SemanticPacket } from '../../src/lib/bosCustomerIntelligence/orchestrator.js';
import { validateLayer3SemanticPacket } from '../../src/lib/bosCustomerIntelligence/translationValidator.js';

const MAX_PACKET_CHARACTERS = 180000;

function featureEnabled() {
  return process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED === 'true';
}
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!featureEnabled()) {
    return res.status(404).json({ error: 'feature_disabled' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'translation_service_unavailable' });
  }

  const packet = req.body?.packet;
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

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transport = (request, options) => openai.responses.create(request, options);
  const result = await translateLayer3SemanticPacket({
    packet,
    enabled: true,
    transport,
    cacheOptions: { storage: null },
  });

  return res.status(200).json(result);
}
