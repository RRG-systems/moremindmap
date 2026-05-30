import { buildVisualDNAPrompt, getVisualDNADesignReference } from '../../../src/lib/visualDNA/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.VISUAL_DNA_ENABLED !== 'true') {
    return res.status(200).json({
      enabled: false,
      status: 'disabled',
      message: 'Visual DNA is disabled.',
    });
  }

  const { context_packet } = req.body || {};

  if (!context_packet) {
    return res.status(400).json({ error: 'context_packet required' });
  }

  const promptResult = buildVisualDNAPrompt(context_packet, getVisualDNADesignReference());

  return res.status(200).json({
    enabled: true,
    status: 'prompt_ready',
    ...promptResult,
  });
}
