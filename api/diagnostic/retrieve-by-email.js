/**
 * Retrieve canonical profile by email from production Vault
 * Safe diagnostic endpoint - returns full canonical dossier
 * 
 * GET /api/diagnostic/retrieve-by-email?email=djbergiii@icloud.com
 */

import { listProfilesByEmail } from '../engine/vault/listCanonicalProfiles.js';
import { getCanonicalProfile, getCanonicalMarkdown } from '../engine/vault/getCanonicalProfile.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ 
      success: false,
      error: 'email parameter required' 
    });
  }
  
  try {
    // Find profiles for this email
    const email_profiles = await listProfilesByEmail(email);
    
    if (email_profiles.count === 0) {
      return res.status(404).json({
        success: false,
        email,
        message: 'No profiles found for this email',
        count: 0
      });
    }
    
    // Get most recent profile (last in sorted array)
    const profile_ids = email_profiles.profile_ids.sort();
    const latest_profile_id = profile_ids[profile_ids.length - 1];
    
    // Retrieve full profile
    const profile = await getCanonicalProfile(latest_profile_id);
    
    if (!profile.found) {
      return res.status(404).json({
        success: false,
        email,
        profile_id: latest_profile_id,
        message: 'Profile ID found in index but profile not retrievable'
      });
    }
    
    // Retrieve markdown
    const markdown = await getCanonicalMarkdown(latest_profile_id);
    
    // Return full dossier
    return res.status(200).json({
      success: true,
      email,
      total_profiles_for_email: email_profiles.count,
      all_profile_ids: profile_ids,
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
    console.error('[RETRIEVE-BY-EMAIL] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}
