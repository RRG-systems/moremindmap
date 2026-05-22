/**
 * Production Redis/Vault Connectivity Check
 * Safe diagnostic endpoint - does not expose secrets
 * 
 * GET /api/diagnostic/redis-vault-check
 */

import Redis from 'ioredis';
import { generateProfileId } from '../engine/vault/generateProfileId.js';
import { saveCanonicalProfile } from '../engine/vault/saveCanonicalProfile.js';
import { getCanonicalProfile } from '../engine/vault/getCanonicalProfile.js';
import { listRecentProfiles, getVaultStats } from '../engine/vault/listCanonicalProfiles.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    commit: 'f374281',
    environment: process.env.VERCEL_ENV || 'unknown',
    checks: {}
  };
  
  try {
    // CHECK 1: Environment variable visibility
    diagnostics.checks.env_visibility = {
      REDIS_URL_present: !!process.env.REDIS_URL,
      REDIS_URL_length: process.env.REDIS_URL ? process.env.REDIS_URL.length : 0,
      REDIS_URL_prefix: process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 8) : null
    };
    
    if (!process.env.REDIS_URL) {
      diagnostics.checks.env_visibility.status = 'FAIL';
      diagnostics.checks.env_visibility.error = 'REDIS_URL not set in runtime environment';
      return res.status(200).json(diagnostics);
    }
    
    diagnostics.checks.env_visibility.status = 'PASS';
    
    // CHECK 2: Redis connectivity
    const redis = new Redis(process.env.REDIS_URL);
    
    try {
      const pong = await redis.ping();
      diagnostics.checks.redis_ping = {
        status: pong === 'PONG' ? 'PASS' : 'FAIL',
        response: pong
      };
    } catch (error) {
      diagnostics.checks.redis_ping = {
        status: 'FAIL',
        error: error.message
      };
      return res.status(200).json(diagnostics);
    }
    
    // CHECK 3: Redis write/read/delete
    const test_key = `vault:diagnostic:test_${Date.now()}`;
    const test_value = JSON.stringify({ test: true, timestamp: Date.now() });
    
    try {
      await redis.set(test_key, test_value);
      const retrieved = await redis.get(test_key);
      const matches = retrieved === test_value;
      await redis.del(test_key);
      
      diagnostics.checks.redis_operations = {
        status: matches ? 'PASS' : 'FAIL',
        write: 'success',
        read: 'success',
        delete: 'success',
        data_integrity: matches
      };
    } catch (error) {
      diagnostics.checks.redis_operations = {
        status: 'FAIL',
        error: error.message
      };
      return res.status(200).json(diagnostics);
    }
    
    // CHECK 4: Vault save test profile
    const test_profile_id = generateProfileId();
    
    const test_canonical = {
      profile_id: test_profile_id,
      metadata: {
        generated_at: new Date().toISOString(),
        test: true,
        diagnostic: true
      },
      vector_scores: {
        vector: 5.0,
        signal: 5.0,
        fidelity: 5.0,
        velocity: 5.0,
        leverage: 5.0,
        flex: 5.0,
        framework: 5.0,
        horizon: 5.0
      }
    };
    
    try {
      const save_result = await saveCanonicalProfile({
        canonical_profile: test_canonical,
        job_id: 'diagnostic_test',
        person_name: 'Diagnostic Test',
        email: 'diagnostic@moremindmap.com',
        company_name: 'Diagnostic Test Co',
        assessment_version: 'diagnostic',
        model: 'diagnostic-test',
        quality_score: 100,
        metadata: { diagnostic: true }
      });
      
      diagnostics.checks.vault_save = {
        status: save_result.success ? 'PASS' : 'FAIL',
        profile_id: save_result.profile_id,
        vault_key: save_result.vault_key,
        company_slug: save_result.company_slug
      };
    } catch (error) {
      diagnostics.checks.vault_save = {
        status: 'FAIL',
        error: error.message
      };
      return res.status(200).json(diagnostics);
    }
    
    // CHECK 5: Vault retrieve
    try {
      const retrieved = await getCanonicalProfile(test_profile_id);
      
      diagnostics.checks.vault_retrieve = {
        status: retrieved.found ? 'PASS' : 'FAIL',
        found: retrieved.found,
        profile_id: retrieved.profile_id,
        has_canonical_json: !!retrieved.canonical_profile_json,
        has_vector_scores: !!retrieved.vector_scores
      };
    } catch (error) {
      diagnostics.checks.vault_retrieve = {
        status: 'FAIL',
        error: error.message
      };
    }
    
    // CHECK 6: Vault list
    try {
      const stats = await getVaultStats();
      const recent = await listRecentProfiles(1);
      
      diagnostics.checks.vault_list = {
        status: 'PASS',
        total_profiles: stats.total_profiles,
        recent_count: recent.count,
        latest_profile_id: recent.profiles[0]?.profile_id || null
      };
    } catch (error) {
      diagnostics.checks.vault_list = {
        status: 'FAIL',
        error: error.message
      };
    }
    
    // CHECK 7: Cleanup test profile
    try {
      await redis.del(`vault:profile:${test_profile_id}`);
      await redis.del(`vault:markdown:${test_profile_id}`);
      
      diagnostics.checks.cleanup = {
        status: 'PASS',
        action: 'Test profile deleted'
      };
    } catch (error) {
      diagnostics.checks.cleanup = {
        status: 'WARN',
        error: error.message,
        note: 'Test profile may remain in Vault'
      };
    }
    
    // Summary
    const all_checks = Object.values(diagnostics.checks);
    const passed = all_checks.filter(c => c.status === 'PASS').length;
    const failed = all_checks.filter(c => c.status === 'FAIL').length;
    
    diagnostics.summary = {
      total_checks: all_checks.length,
      passed,
      failed,
      overall_status: failed === 0 ? 'ALL_PASS' : 'SOME_FAIL',
      safe_for_live_assessment: failed === 0
    };
    
    await redis.quit();
    
    return res.status(200).json(diagnostics);
    
  } catch (error) {
    diagnostics.error = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    };
    
    return res.status(500).json(diagnostics);
  }
}
