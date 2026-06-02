import {
  VISUAL_DNA_VERSION,
  createRedisClient,
  hashObject,
  writeVisualDNAMetadata,
} from './shared.js';

const APPROVED_VISUALS = [
  {
    profile_id: 'mm-20260529-ceo8x7q2',
    slug: 'marcus-vale',
    image_path: '/visual-dna-test/marcus-vale.png',
  },
  {
    profile_id: 'mm-20260529-acc2f9d6',
    slug: 'nora-bell',
    image_path: '/visual-dna-test/nora-bell.png',
  },
];

function isAuthorized(req) {
  const expected = process.env.ADMIN_GPT_RESCORE_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  return header === `Bearer ${expected}`;
}

function getPublicBaseUrl(req) {
  const configured = process.env.SITE_URL || '';
  if (configured) return configured.replace(/\/$/, '');

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'moremindmap.com';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function buildApprovedMetadata(req, visual) {
  const baseUrl = getPublicBaseUrl(req);
  const imageUrl = `${baseUrl}${visual.image_path}`;
  const approvalFingerprint = {
    profile_id: visual.profile_id,
    image_url: imageUrl,
    visual_dna_version: VISUAL_DNA_VERSION,
    approval_version: 'curated-static-v1',
  };

  return {
    profile_id: visual.profile_id,
    image_url: imageUrl,
    prompt_hash: `curated_static_${visual.slug}_v1`,
    profile_hash: hashObject(approvalFingerprint),
    generated_at: new Date().toISOString(),
    model: 'manual-approved',
    provider: 'curated_static',
    visual_dna_version: VISUAL_DNA_VERSION,
    design_reference_version: 'reference-a-b-marcus-nora-v3',
    prompt_version: 'visual-dna-prompt-v3-canonical-dashboard',
    generation_workflow: 'curated_reference_static_to_approval',
    reference_standard: 'marcus-nora-v1',
    approval_required: false,
    status: 'approved',
    approved: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const seeded = [];

    for (const visual of APPROVED_VISUALS) {
      const metadata = buildApprovedMetadata(req, visual);
      await writeVisualDNAMetadata(redis, metadata);
      seeded.push(metadata);
    }

    return res.status(200).json({
      success: true,
      seeded_count: seeded.length,
      visual_dna: seeded,
    });
  } catch (error) {
    console.error('[VISUAL DNA SEED APPROVED] Error:', error);
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
