import {
  createRedisClient,
  readVisualDNAMetadata,
  writeVisualDNAMetadata,
} from './shared.js';

export const config = {
  maxDuration: 30,
};

function isAuthorized(req) {
  const expected = process.env.ADMIN_GPT_RESCORE_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${expected}`;
}

function normalizeAction(action) {
  const value = String(action || 'approve').trim().toLowerCase();
  if (value === 'reject' || value === 'rejected') return 'rejected';
  return 'approved';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { profile_id, action = 'approve' } = req.body || {};
  if (!profile_id) {
    return res.status(400).json({ error: 'profile_id required' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const existing = await readVisualDNAMetadata(redis, profile_id);

    if (!existing?.image_url) {
      return res.status(404).json({
        success: false,
        error: 'Visual DNA metadata not found',
        profile_id,
      });
    }

    const status = normalizeAction(action);
    const metadata = {
      ...existing,
      status,
      approved: status === 'approved',
      reviewed_at: new Date().toISOString(),
      review_source: 'admin_visual_dna_approval',
    };

    await writeVisualDNAMetadata(redis, metadata);

    return res.status(200).json({
      success: true,
      status,
      visual_dna: metadata,
    });
  } catch (error) {
    console.error('[VISUAL DNA APPROVE] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    if (redis) {
      await redis.disconnect().catch(() => {});
    }
  }
}
