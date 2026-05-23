/**
 * Diagnostic Endpoint: Dump Raw Job Data
 * GET /api/diagnostic/dump-job?job_id=...
 * 
 * Return full job record to inspect vault save diagnostics
 */

import { redisGet, redis as getRedis } from '../engine/redisClient.js';

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
    const { job_id } = req.query;

    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: 'job_id required'
      });
    }

    const job = await redisGet(`job:${job_id}`);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        job_id
      });
    }

    // Extract just the canonical diagnostics
    const result = {
      success: true,
      job_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
      status: job.status,
      canonical_generation_attempted:
        job.canonical_diagnostics?.attempted || false,
      canonical_generation_success:
        job.canonical_diagnostics?.success || false,
      canonical_profile_id: job.canonical_diagnostics?.profile_id || null,
      vault_save_success: job.canonical_diagnostics?.vault_save_success || false,
      vault_save_attempted: job.canonical_diagnostics?.vault_save_attempted || false,

      // Full canonical_diagnostics object
      full_canonical_diagnostics: job.canonical_diagnostics || {
        _not_found: 'No canonical_diagnostics in job record'
      },

      // Raw vault_save_diagnostics if present
      vault_save_diagnostics_present:
        !!job.canonical_diagnostics?.vault_save_diagnostics,
      vault_save_diagnostics:
        job.canonical_diagnostics?.vault_save_diagnostics || {
          _not_found: 'Not present in job record'
        }
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('[DUMP-JOB] Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to dump job',
      timestamp: new Date().toISOString()
    });
  }
}
