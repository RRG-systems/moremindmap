/**
 * Diagnostic Endpoint: Inspect Vault Save Diagnostics
 * GET /api/diagnostic/inspect-vault-save?limit=1
 * 
 * Retrieve detailed diagnostics from recent canonical profile saves
 */

import { redisGet, redis as getRedis } from '../engine/redisClient.js';

function summarizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') {
    return error.substring(0, 200);
  }
  if (error.message) {
    return error.message.substring(0, 200);
  }
  return String(error).substring(0, 200);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit || '1'), 10);
    const rc = getRedis();

    // Fetch recent jobs
    let jobIds = [];
    try {
      jobIds = await rc.lrange('jobs:recent', 0, Math.max(0, limit - 1));
    } catch (e) {
      return res.status(200).json({
        ok: true,
        error: 'No jobs in recent index',
        jobs: []
      });
    }

    if (!jobIds || jobIds.length === 0) {
      return res.status(200).json({
        ok: true,
        error: 'No jobs found',
        jobs: []
      });
    }

    // Fetch job data and extract vault save diagnostics
    const jobs = [];
    for (const jobId of jobIds) {
      try {
        const job = await redisGet(`job:${jobId}`);

        if (job && job.canonical_diagnostics) {
          const canonicalDiag = job.canonical_diagnostics;

          jobs.push({
            job_id: jobId,
            created_at: job.created_at,
            updated_at: job.updated_at,
            canonical_profile_id: canonicalDiag.profile_id || null,
            vault_save_success: canonicalDiag.vault_save_success || false,
            vault_save_attempted: canonicalDiag.vault_save_attempted || false,
            vault_save_error: summarizeError(
              canonicalDiag.vault_save_error
            ),
            person_name: job.payload?.metadata?.person_name || null,
            email_masked: job.payload?.metadata?.email
              ? job.payload.metadata.email.substring(0, 2) +
                '***@' +
                job.payload.metadata.email.split('@')[1]
              : null,

            // Detailed vault save diagnostics
            vault_save_diagnostics: canonicalDiag.vault_save_diagnostics || {
              _missing: 'No detailed diagnostics captured'
            }
          });
        }
      } catch (e) {
        // Skip jobs that can't be fetched
      }
    }

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      jobs_inspected: jobs.length,
      jobs
    });
  } catch (error) {
    console.error('[INSPECT-VAULT-SAVE] Error:', error);

    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to inspect vault saves',
      timestamp: new Date().toISOString()
    });
  }
}
