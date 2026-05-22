/**
 * Get latest canonical profile from Vault
 * Returns full dossier for inspection
 * 
 * GET /api/diagnostic/get-latest-profile
 */

import { listRecentProfiles } from '../engine/vault/listCanonicalProfiles.js';
import { getCanonicalProfile, getCanonicalMarkdown } from '../engine/vault/getCanonicalProfile.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get latest profile
    const recent = await listRecentProfiles(1);
    
    if (recent.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'No profiles in Vault',
        total_available: recent.total_available
      });
    }
    
    const latest_profile_id = recent.profiles[0].profile_id;
    
    // Retrieve full profile
    const profile = await getCanonicalProfile(latest_profile_id);
    
    if (!profile.found) {
      return res.status(404).json({
        success: false,
        profile_id: latest_profile_id,
        message: 'Latest profile not retrievable'
      });
    }
    
    // Retrieve markdown
    const markdown = await getCanonicalMarkdown(latest_profile_id);
    
    // Return full dossier
    return res.status(200).json({
      success: true,
      latest_profile_id,
      profile: {
        profile_id: profile.profile_id,
        person_name: profile.person_name,
        email: profile.email,
        company_name: profile.company_name,
        company_slug: profile.company_slug,
        created_at: profile.created_at,
        job_id: profile.job_id,
        assessment_version: profile.assessment_version,
        model: profile.model,
        quality_score: profile.quality_score,
        profile_signature: profile.profile_signature,
        canonical_profile_json: profile.canonical_profile_json,
        metadata: profile.metadata
      },
      markdown: markdown.found ? {
        found: true,
        markdown_size: markdown.markdown_size,
        markdown_content: markdown.markdown
      } : {
        found: false,
        error: markdown.error
      }
    });
    
  } catch (error) {
    console.error('[GET-LATEST-PROFILE] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
