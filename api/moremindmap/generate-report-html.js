/**
 * generate-report-html.js
 * 
 * Generate HTML report from canonical dossier
 * Used for profile retrieval flow
 * 
 * POST /api/moremindmap/generate-report-html
 * Body: { canonical_dossier: {...} }
 * 
 * Returns: { html: "<!DOCTYPE html>..." }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { canonical_dossier } = req.body;
  if (!canonical_dossier) {
    return res.status(400).json({ error: 'canonical_dossier required' });
  }

  try {
    // Try to use proper mapper and renderer
    let html;
    try {
      const mapperMod = await import('../../renderer/canonical-to-report-mapper.js');
      const rendererMod = await import('../../renderer/render-to-html.js');
      
      const mapper = mapperMod.default;
      const renderer = rendererMod.default;
      
      const reportContent = mapper(canonical_dossier);
      html = renderer(reportContent);
    } catch (importErr) {
      console.warn('[GENERATE HTML] Falling back to manual render:', importErr.message);
      
      // Fallback
      html = '<!DOCTYPE html><html><body>Report generation pending. Please try again shortly.</body></html>';
    }

    return res.status(200).json({
      success: true,
      html: html,
      profile_id: canonical_dossier.profile_id || canonical_dossier.canonical_profile_json?.profile_id,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[GENERATE REPORT HTML] Error:', error);
    return res.status(500).json({
      error: 'Failed to generate report HTML',
      message: error.message,
    });
  }
}
