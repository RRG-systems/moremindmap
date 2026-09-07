/**
 * List all canonical profiles in Vault with metadata
 * Safe diagnostic endpoint for inspection
 * 
 * GET /api/diagnostic/list-all-profiles
 */

import { getVaultStats, listRecentProfiles } from '../engine/vault/listCanonicalProfiles.js';
import { getCanonicalProfile } from '../engine/vault/getCanonicalProfile.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get stats
    const stats = await getVaultStats();
    
    // Get all profiles (up to 50)
    const all_profiles = await listRecentProfiles(50);
    
    // Get full metadata for each (not full canonical JSON, just metadata)
    const profiles_with_metadata = await Promise.all(
      all_profiles.profiles.map(async (p) => {
        const full = await getCanonicalProfile(p.profile_id);
        
        return {
          profile_id: full.profile_id,
          person_name: full.person_name,
          email: full.email,
          company_name: full.company_name,
          company_slug: full.company_slug,
          created_at: full.created_at,
          job_id: full.job_id,
          assessment_version: full.assessment_version,
          model: full.model,
          quality_score: full.quality_score,
          profile_signature: full.profile_signature,
          has_canonical_json: !!full.canonical_profile_json,
          has_evidence_map: !!full.canonical_profile_json?.evidence_map,
          has_causal_chains: !!full.canonical_profile_json?.causal_chains,
          has_contradictions: !!full.canonical_profile_json?.contradictions,
          is_diagnostic: full.metadata?.diagnostic === true || full.assessment_version === 'diagnostic'
        };
      })
    );
    
    // Separate diagnostic vs real
    const diagnostic_profiles = profiles_with_metadata.filter(p => p.is_diagnostic);
    const real_profiles = profiles_with_metadata.filter(p => !p.is_diagnostic);
    
    return res.status(200).json({
      success: true,
      stats,
      total_profiles: all_profiles.total_available,
      retrieved_count: profiles_with_metadata.length,
      diagnostic_count: diagnostic_profiles.length,
      real_count: real_profiles.length,
      diagnostic_profiles,
      real_profiles,
      all_profiles: profiles_with_metadata
    });
    
  } catch (error) {
    console.error('[LIST-ALL-PROFILES] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
